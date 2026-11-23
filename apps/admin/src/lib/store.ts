"use client";

import { useSyncExternalStore } from "react";
import type {
  AppState,
  Client,
  PaymentMethod,
  Product,
  Sale,
  Settings,
  Supplier,
  Transaction,
} from "@tendencias/core/types";
import { round2, uid } from "@tendencias/core/format";
import { STATE_VERSION, createEmptyState, createSeedState } from "./seed";

/**
 * Store local baseado em LocalStorage.
 * ATENÇÃO: demonstração — os dados ficam apenas neste navegador, sem
 * criptografia, backup ou suporte a múltiplos usuários.
 */
const STORAGE_KEY = "tendencias-makeup:v1";

let cache: AppState | null = null;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = createEmptyState();

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.version === STATE_VERSION) return parsed;
    }
  } catch {
    /* dados corrompidos: recomeça com a demonstração */
  }
  return createSeedState();
}

function getSnapshot(): AppState {
  if (!cache) {
    cache = load();
    persist(cache);
  }
  return cache;
}

function persist(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = load();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: AppState): boolean {
  cache = next;
  const ok = persist(next);
  listeners.forEach((l) => l());
  return ok;
}

function current(): AppState {
  return getSnapshot();
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

const noopSubscribe = () => () => {};
/** true somente depois da hidratação no cliente. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

export type ProductInput = Omit<Product, "id" | "createdAt">;
export type ClientInput = Omit<Client, "id" | "createdAt">;
export type SupplierInput = Omit<Supplier, "id">;
export type TransactionInput = Omit<Transaction, "id">;

export interface SaleInput {
  items: { productId: string; qty: number }[];
  discount: number;
  payment: PaymentMethod;
  clientId: string | null;
}

export const actions = {
  // ---------- Produtos ----------
  addProduct(input: ProductInput): Result<Product> {
    const s = current();
    if (s.products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase()))
      return fail("Já existe um produto com este código/SKU.");
    if (input.stock < 0) return fail("O estoque não pode ser negativo.");
    const product: Product = { ...input, id: uid(), createdAt: new Date().toISOString() };
    commit({ ...s, products: [product, ...s.products] });
    return ok(product);
  },

  updateProduct(id: string, input: ProductInput): Result {
    const s = current();
    if (s.products.some((p) => p.id !== id && p.sku.toLowerCase() === input.sku.toLowerCase()))
      return fail("Já existe outro produto com este código/SKU.");
    if (input.stock < 0) return fail("O estoque não pode ser negativo.");
    commit({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, ...input } : p)) });
    return ok(undefined);
  },

  deleteProduct(id: string): Result {
    const s = current();
    commit({ ...s, products: s.products.filter((p) => p.id !== id) });
    return ok(undefined);
  },

  /** Entrada (delta > 0) ou saída (delta < 0) manual de estoque. */
  adjustStock(id: string, delta: number): Result<number> {
    const s = current();
    const product = s.products.find((p) => p.id === id);
    if (!product) return fail("Produto não encontrado.");
    const next = product.stock + delta;
    if (next < 0) return fail(`Estoque insuficiente: há apenas ${product.stock} unidade(s).`);
    commit({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, stock: next } : p)) });
    return ok(next);
  },

  // ---------- Clientes ----------
  addClient(input: ClientInput): Result<Client> {
    const s = current();
    const client: Client = { ...input, id: uid(), createdAt: new Date().toISOString() };
    commit({ ...s, clients: [client, ...s.clients] });
    return ok(client);
  },

  updateClient(id: string, input: ClientInput): Result {
    const s = current();
    commit({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...input } : c)) });
    return ok(undefined);
  },

  deleteClient(id: string): Result {
    const s = current();
    commit({
      ...s,
      clients: s.clients.filter((c) => c.id !== id),
      sales: s.sales.map((x) => (x.clientId === id ? { ...x, clientId: null } : x)),
    });
    return ok(undefined);
  },

  // ---------- Fornecedores ----------
  addSupplier(input: SupplierInput): Result<Supplier> {
    const s = current();
    const supplier: Supplier = { ...input, id: uid() };
    commit({ ...s, suppliers: [supplier, ...s.suppliers] });
    return ok(supplier);
  },

  updateSupplier(id: string, input: SupplierInput): Result {
    const s = current();
    commit({ ...s, suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...input } : x)) });
    return ok(undefined);
  },

  deleteSupplier(id: string): Result {
    const s = current();
    commit({
      ...s,
      suppliers: s.suppliers.filter((x) => x.id !== id),
      products: s.products.map((p) => (p.supplierId === id ? { ...p, supplierId: null } : p)),
    });
    return ok(undefined);
  },

  // ---------- Vendas ----------
  /** Valida estoque, registra a venda e baixa o estoque de forma atômica. */
  finalizeSale(input: SaleInput): Result<Sale> {
    const s = current();
    if (input.items.length === 0) return fail("Adicione ao menos um produto ao carrinho.");

    const items: Sale["items"] = [];
    for (const line of input.items) {
      const product = s.products.find((p) => p.id === line.productId);
      if (!product) return fail("Um dos produtos do carrinho não existe mais.");
      if (!Number.isInteger(line.qty) || line.qty < 1)
        return fail(`Quantidade inválida para "${product.name}".`);
      if (line.qty > product.stock)
        return fail(`Estoque insuficiente para "${product.name}": disponível ${product.stock}.`);
      items.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qty: line.qty,
        unitPrice: product.salePrice,
        unitCost: product.costPrice,
      });
    }

    const subtotal = round2(items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0));
    if (input.discount < 0) return fail("O desconto não pode ser negativo.");
    if (input.discount > subtotal) return fail("O desconto não pode ser maior que o subtotal.");

    const number = s.saleCounter + 1;
    const sale: Sale = {
      id: uid(),
      number,
      date: new Date().toISOString(),
      clientId: input.clientId,
      items,
      subtotal,
      discount: round2(input.discount),
      total: round2(subtotal - input.discount),
      payment: input.payment,
    };

    const sold = new Map(items.map((i) => [i.productId, i.qty]));
    commit({
      ...s,
      saleCounter: number,
      sales: [sale, ...s.sales],
      products: s.products.map((p) =>
        sold.has(p.id) ? { ...p, stock: p.stock - (sold.get(p.id) ?? 0) } : p,
      ),
    });
    return ok(sale);
  },

  /** Cancela a venda e devolve os itens ao estoque (produtos ainda cadastrados). */
  cancelSale(id: string): Result {
    const s = current();
    const sale = s.sales.find((x) => x.id === id);
    if (!sale) return fail("Venda não encontrada.");
    const back = new Map(sale.items.map((i) => [i.productId, i.qty]));
    commit({
      ...s,
      sales: s.sales.filter((x) => x.id !== id),
      products: s.products.map((p) =>
        back.has(p.id) ? { ...p, stock: p.stock + (back.get(p.id) ?? 0) } : p,
      ),
    });
    return ok(undefined);
  },

  // ---------- Financeiro ----------
  addTransaction(input: TransactionInput): Result<Transaction> {
    const s = current();
    const t: Transaction = { ...input, id: uid() };
    commit({ ...s, transactions: [t, ...s.transactions] });
    return ok(t);
  },

  deleteTransaction(id: string): Result {
    const s = current();
    commit({ ...s, transactions: s.transactions.filter((t) => t.id !== id) });
    return ok(undefined);
  },

  // ---------- Configurações / dados ----------
  updateSettings(settings: Settings): Result {
    const s = current();
    const saved = commit({ ...s, settings });
    return saved ? ok(undefined) : fail("Não foi possível salvar (armazenamento do navegador cheio?).");
  },

  resetDemo(): Result {
    commit(createSeedState());
    return ok(undefined);
  },

  /** Zera produtos, vendas, clientes etc. mantendo as configurações da loja. */
  clearAll(): Result {
    const s = current();
    commit({ ...createEmptyState(false), settings: s.settings });
    return ok(undefined);
  },
};
