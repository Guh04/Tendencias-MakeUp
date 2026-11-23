"use client";

import { useSyncExternalStore } from "react";
import type { AppState, PaymentMethod, Product, Sale, Settings } from "@tendencias/core/types";
import { createClient } from "@/lib/supabase/client";
import { createEmptyState } from "./defaults";
import {
  friendlyError,
  mapClient,
  mapProduct,
  mapSale,
  mapSettings,
  mapSupplier,
  mapTransaction,
  toCents,
  type ProductRow,
  type SaleRow,
  type SettingsRow,
  type TransactionRow,
} from "./mappers";

/**
 * Store do ADMIN conectado ao banco central (Supabase).
 * Mantem uma copia em memoria para as telas e recarrega apos cada operacao
 * e quando o PDV (ou outro usuario) altera os dados (tempo real).
 */
export type DataStatus = "idle" | "loading" | "ready" | "error";
interface Meta {
  status: DataStatus;
  error: string;
}

const EMPTY = createEmptyState();
let state: AppState = EMPTY;
let meta: Meta = { status: "idle", error: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(next: AppState) {
  state = next;
  emit();
}
function setMeta(next: Meta) {
  meta = next;
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
export function useDataStatus(): Meta {
  return useSyncExternalStore(subscribe, () => meta, () => meta);
}

// ---------------------------------------------------------------------------
// Carga de dados
// ---------------------------------------------------------------------------
type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

const COUNTED = new Set(["paga", "devolvida_parcial", "devolvida"]);

async function load(): Promise<AppState> {
  const db = createClient();
  const [products, clients, suppliers, sales, transactions, settings, profiles] = await Promise.all([
    fetchAll<ProductRow>((a, b) =>
      db
        .from("products")
        .select("*, product_costs(cost_cents)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .range(a, b) as unknown as PageResult<ProductRow>,
    ),
    fetchAll<{ id: string; name: string; phone: string; email: string; created_at: string }>((a, b) =>
      db.from("clients").select("*").order("created_at", { ascending: false }).range(a, b) as unknown as PageResult<never>,
    ),
    fetchAll<{ id: string; name: string; contact: string; phone: string; email: string; notes: string }>((a, b) =>
      db.from("suppliers").select("*").eq("active", true).order("created_at", { ascending: false }).range(a, b) as unknown as PageResult<never>,
    ),
    fetchAll<SaleRow>((a, b) =>
      db
        .from("sales")
        .select(
          "id, number, channel, status, operator_id, client_id, subtotal_cents, discount_cents, total_cents, created_at, paid_at, cancel_reason, " +
            "sale_items(id, product_id, name, sku, qty, unit_price_cents, returned_qty, sale_item_costs(unit_cost_cents)), " +
            "sale_payments(method, amount_cents, received_cents, change_cents), returns(refund_cents)",
        )
        .order("created_at", { ascending: false })
        .range(a, b) as unknown as PageResult<SaleRow>,
    ),
    fetchAll<TransactionRow>((a, b) =>
      db.from("transactions").select("*").order("occurred_on", { ascending: false }).range(a, b) as unknown as PageResult<TransactionRow>,
    ),
    db.from("settings").select("*").maybeSingle(),
    db.from("profiles").select("id, full_name"),
  ]);
  if (settings.error) throw new Error(settings.error.message);

  const allSales = sales.map(mapSale);
  return {
    products: products.map(mapProduct),
    clients: clients.map(mapClient),
    suppliers: suppliers.map(mapSupplier),
    allSales,
    sales: allSales.filter((s) => COUNTED.has(s.status)),
    transactions: transactions.map(mapTransaction),
    settings: settings.data ? mapSettings(settings.data as SettingsRow) : EMPTY.settings,
    operators: (profiles.data ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string })),
  };
}

let reloading = false;
let queued = false;
export async function reload(): Promise<void> {
  if (reloading) {
    queued = true;
    return;
  }
  reloading = true;
  try {
    setState(await load());
    setMeta({ status: "ready", error: "" });
  } catch (e) {
    const message = friendlyError(e instanceof Error ? e.message : String(e));
    // mantem os dados antigos se ja havia carga; so mostra erro de tela cheia na primeira vez
    setMeta({ status: meta.status === "ready" ? "ready" : "error", error: message });
  } finally {
    reloading = false;
    if (queued) {
      queued = false;
      void reload();
    }
  }
}

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

/** Inicia a carga e a escuta em tempo real (idempotente). */
export function startStore() {
  if (started) return;
  started = true;
  setMeta({ status: "loading", error: "" });
  void reload();
  const db = createClient();
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void reload(), 400);
  };
  let ch = db.channel("admin-sync");
  for (const table of ["products", "sales", "clients", "stock_movements", "cash_sessions"])
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
  channel = ch.subscribe();
}

export function stopStore() {
  if (timer) clearTimeout(timer);
  if (channel) void createClient().removeChannel(channel);
  channel = null;
  started = false;
  state = EMPTY;
  setMeta({ status: "idle", error: "" });
}

// ---------------------------------------------------------------------------
// Operacoes (todas gravam no banco e recarregam)
// ---------------------------------------------------------------------------
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error: friendlyError(error) });

async function run<T>(fn: () => Promise<{ data?: T; error: { message: string } | null }>): Promise<Result<T | undefined>> {
  try {
    const { data, error } = await fn();
    if (error) return fail(error.message);
    await reload();
    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erro inesperado.");
  }
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  description: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  supplierId: string | null;
  imageUrl: string | null;
}
export type ClientInput = { name: string; phone: string; email: string };
export type SupplierInput = { name: string; contact: string; phone: string; email: string; notes: string };
export type TransactionInput = { date: string; type: "entrada" | "saida"; category: string; description: string; amount: number };

export interface SaleInput {
  items: { productId: string; qty: number }[];
  discount: number;
  payment: PaymentMethod;
  /** Valor recebido (apenas dinheiro, para calcular troco). */
  received?: number;
  clientId: string | null;
}

const db = () => createClient();

export const actions = {
  // ---------- Produtos ----------
  async addProduct(input: ProductInput): Promise<Result<undefined>> {
    return run(async () =>
      db().rpc("create_product", {
        p_name: input.name,
        p_barcode: input.barcode,
        p_category: input.category,
        p_cost_cents: toCents(input.costPrice),
        p_price_cents: toCents(input.salePrice),
        p_stock: input.stock,
        p_description: input.description,
        p_image_url: input.imageUrl,
        p_brand: input.brand,
        p_sku: input.sku,
        p_min_stock: input.minStock,
        p_supplier_id: input.supplierId,
        p_origin: "admin",
      }),
    ) as Promise<Result<undefined>>;
  },

  async updateProduct(id: string, input: ProductInput): Promise<Result<undefined>> {
    const current = state.products.find((p) => p.id === id);
    try {
      const { error } = await db()
        .from("products")
        .update({
          name: input.name.trim(),
          sku: input.sku.trim(),
          barcode: input.barcode.trim() || null,
          category: input.category,
          brand: input.brand,
          description: input.description,
          price_cents: toCents(input.salePrice),
          min_stock: input.minStock,
          supplier_id: input.supplierId,
          image_url: input.imageUrl,
        })
        .eq("id", id);
      if (error) return fail(error.message);
      const { error: costErr } = await db()
        .from("product_costs")
        .upsert({ product_id: id, cost_cents: toCents(input.costPrice) });
      if (costErr) return fail(costErr.message);
      if (current && input.stock !== current.stock) {
        const { error: stockErr } = await db().rpc("adjust_stock", {
          p_product_id: id,
          p_delta: input.stock - current.stock,
          p_reason: "Ajuste na edição do produto",
          p_type: "ajuste",
          p_origin: "admin",
        });
        if (stockErr) return fail(stockErr.message);
      }
      await reload();
      return ok(undefined);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Erro inesperado.");
    }
  },

  /** Produtos nunca sao apagados (o historico de vendas depende deles): ficam arquivados. */
  archiveProduct(id: string) {
    return run(async () => db().from("products").update({ active: false }).eq("id", id));
  },

  /** Entrada (delta > 0) ou saida (delta < 0) manual de estoque. */
  adjustStock(id: string, delta: number, reason: string) {
    return run(async () =>
      db().rpc("adjust_stock", {
        p_product_id: id,
        p_delta: delta,
        p_reason: reason || null,
        p_type: delta > 0 ? "entrada" : "saida",
        p_origin: "admin",
      }),
    );
  },

  // ---------- Clientes ----------
  addClient(input: ClientInput) {
    return run(async () => db().from("clients").insert({ name: input.name, phone: input.phone, email: input.email }));
  },
  updateClient(id: string, input: ClientInput) {
    return run(async () => db().from("clients").update({ name: input.name, phone: input.phone, email: input.email }).eq("id", id));
  },
  deleteClient(id: string) {
    return run(async () => db().from("clients").delete().eq("id", id));
  },

  // ---------- Fornecedores ----------
  addSupplier(input: SupplierInput) {
    return run(async () => db().from("suppliers").insert(input));
  },
  updateSupplier(id: string, input: SupplierInput) {
    return run(async () => db().from("suppliers").update(input).eq("id", id));
  },
  /** Arquiva o fornecedor (produtos vinculados mantem o historico). */
  deleteSupplier(id: string) {
    return run(async () => db().from("suppliers").update({ active: false }).eq("id", id));
  },

  // ---------- Vendas ----------
  async finalizeSale(input: SaleInput): Promise<Result<Sale | undefined>> {
    if (input.items.length === 0) return fail("Adicione ao menos um produto ao carrinho.");
    const discount = toCents(input.discount);
    const subtotal = input.items.reduce((sum, l) => {
      const p = state.products.find((x) => x.id === l.productId);
      return sum + (p ? toCents(p.salePrice) * l.qty : 0);
    }, 0);
    const total = subtotal - discount;
    const received = input.payment === "dinheiro" ? toCents(input.received ?? total / 100) : total;
    try {
      const { data, error } = await db().rpc("checkout_sale", {
        p_items: input.items.map((l) => ({ product_id: l.productId, qty: l.qty })),
        p_payments: [{ method: input.payment, amount_cents: total, received_cents: received }],
        p_discount_cents: discount,
        p_client_id: input.clientId,
        p_channel: "presencial",
        p_require_session: false,
        p_origin: "admin",
      });
      if (error) return fail(error.message);
      await reload();
      const saleId = (data as { id: string }).id;
      return ok(state.allSales.find((s) => s.id === saleId));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Erro inesperado.");
    }
  },

  /** Cancela (nunca apaga) e devolve o estoque. Exige motivo. */
  cancelSale(id: string, reason: string) {
    return run(async () => db().rpc("cancel_sale", { p_sale_id: id, p_reason: reason }));
  },

  // ---------- Financeiro ----------
  addTransaction(input: TransactionInput) {
    return run(async () =>
      db().from("transactions").insert({
        occurred_on: input.date.slice(0, 10),
        type: input.type,
        category: input.category,
        description: input.description,
        amount_cents: toCents(input.amount),
      }),
    );
  },
  deleteTransaction(id: string) {
    return run(async () => db().from("transactions").delete().eq("id", id));
  },

  // ---------- Configuracoes ----------
  updateSettings(s: Settings) {
    return run(async () =>
      db()
        .from("settings")
        .update({
          store_name: s.storeName,
          logo_url: s.logo || null,
          phone: s.phone,
          email: s.email,
          address: s.address,
          cnpj: s.cnpj,
          owner: s.owner,
          instagram: s.instagram,
          default_min_stock: s.defaultMinStock,
          default_payment: s.defaultPayment,
          low_stock_alerts: s.lowStockAlerts,
          max_operator_discount_pct: s.maxOperatorDiscountPct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true),
    );
  },
};

export type { Product };
