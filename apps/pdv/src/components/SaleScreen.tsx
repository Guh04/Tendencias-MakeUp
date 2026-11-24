"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, History, House, ImageIcon, Lock, LogOut, UserRound, Minus, PackagePlus, Plus, ScanBarcode, ShoppingCart, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth, type Profile } from "@/hooks/useAuth";
import type { Catalog } from "@/hooks/useCatalog";
import type { CashSession, PosProduct, ReceiptData } from "@/lib/types";
import { brl, friendly, parseCents } from "@/lib/money";
import { parseNumber } from "@tendencias/core/format";
import { useConfirm, useToast } from "@tendencias/ui/feedback";
import { Button, IconButton } from "@tendencias/ui/button";
import { EmptyState } from "@tendencias/ui/empty-state";
import { Input, Select } from "@tendencias/ui/form";
import { CashMovementModal } from "./CashMovementModal";
import { ClientPicker, type PosClient } from "./ClientPicker";
import { CloseCashModal } from "./CloseCashModal";
import { HistoryModal } from "./HistoryModal";
import { NewProductModal } from "./NewProductModal";
import { PaymentModal, type PaymentLine } from "./PaymentModal";
import { ReceiptModal } from "./Receipt";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SaleScreen({
  session,
  profile,
  catalog,
  onHome,
  onSessionClosed,
}: {
  session: CashSession;
  profile: Profile;
  catalog: Catalog;
  onHome: () => void;
  onSessionClosed: () => void;
}) {
  const { signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { products, settings, status, reload } = catalog;

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discountText, setDiscountText] = useState("");
  const [discountMode, setDiscountMode] = useState<"valor" | "percent">("valor");
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [client, setClient] = useState<PosClient | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile.role === "admin";
  const canOverride = profile.can_override_stock || isAdmin;
  const anyModal = payOpen || !!receipt || newOpen || histOpen || moveOpen || closeOpen || clientOpen;

  const results = useMemo(() => {
    const t = norm(q.trim());
    const list = t
      ? products.filter((p) => norm(p.name).includes(t) || norm(p.sku).includes(t) || p.barcode.includes(q.trim()))
      : products;
    return list.slice(0, 60);
  }, [products, q]);

  const lines = useMemo(
    () =>
      Object.entries(cart).flatMap(([id, qty]) => {
        const product = products.find((p) => p.id === id);
        return product ? [{ product, qty }] : [];
      }),
    [cart, products],
  );
  const subtotal = lines.reduce((s, l) => s + l.qty * l.product.priceCents, 0);

  let discount = 0;
  let discountError = "";
  if (discountText.trim()) {
    const v = parseNumber(discountText);
    if (!Number.isFinite(v) || v < 0) discountError = "Desconto inválido.";
    else if (discountMode === "percent") {
      if (v > 100) discountError = "Máximo 100%.";
      else discount = Math.round((subtotal * v) / 100);
    } else {
      discount = parseCents(discountText);
      if (discount > subtotal) discountError = "Maior que o subtotal.";
    }
    if (!discountError && !isAdmin && discount * 100 > subtotal * settings.maxOperatorDiscountPct)
      discountError = `Acima do limite do operador (${settings.maxOperatorDiscountPct}%). Chame um administrador.`;
  }
  const total = subtotal - (discountError ? 0 : discount);
  const oversell = lines.some((l) => l.qty > l.product.stock);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  function setQty(product: PosProduct, qty: number) {
    if (qty <= 0) {
      setCart((c) => {
        const { [product.id]: removed, ...rest } = c;
        void removed;
        return rest;
      });
      return;
    }
    if (qty > product.stock && !canOverride) {
      toast.error(
        product.stock === 0
          ? `"${product.name}" está sem estoque.`
          : `Estoque insuficiente: "${product.name}" tem apenas ${product.stock} unidade(s).`,
      );
      if (product.stock === 0) return;
      qty = product.stock;
    }
    setCart((c) => ({ ...c, [product.id]: qty }));
  }

  function addProduct(p: PosProduct) {
    setQty(p, (cart[p.id] ?? 0) + 1);
    setQ("");
    setActive(0);
    focusSearch();
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setQ("");
      setActive(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const code = q.trim();
      if (!code) return;
      // leitor de codigo de barras: codigo exato (ou SKU) adiciona direto
      const exact = products.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
      if (exact) return addProduct(exact);
      if (results[active]) return addProduct(results[active]);
      toast.error(`Produto não encontrado: ${code}`);
      if (/^\d{4,}$/.test(code)) {
        setNewBarcode(code);
        setNewOpen(true);
      }
    }
  }

  // atalhos globais
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (anyModal) return;
      if (e.key === "F2") {
        e.preventDefault();
        focusSearch();
      } else if (e.key === "F3") {
        e.preventDefault();
        setClientOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        discountRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        openPayment();
      } else if (e.key === "F6") {
        e.preventDefault();
        setMoveOpen(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        setHistOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        openClose();
      } else if (e.key === "F1") {
        e.preventDefault();
        void goHome();
      } else if (e.key === "F10") {
        e.preventDefault();
        setNewBarcode("");
        setNewOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModal, lines.length, discountError, focusSearch]);

  useEffect(() => {
    if (!anyModal) focusSearch();
  }, [anyModal, focusSearch]);

  async function goHome() {
    if (lines.length > 0) {
      const ok = await confirm({
        title: "Voltar ao início?",
        message: "O carrinho atual será descartado.",
        confirmLabel: "Descartar e voltar",
        danger: true,
      });
      if (!ok) return;
    }
    onHome();
  }

  function openClose() {
    if (lines.length > 0) return toast.error("Finalize ou limpe o carrinho antes de fechar o caixa.");
    setCloseOpen(true);
  }

  function openPayment() {
    if (lines.length === 0) return toast.error("Adicione ao menos um produto ao carrinho.");
    if (discountError) return toast.error(discountError);
    setPayOpen(true);
  }

  async function confirmPayment(payments: PaymentLine[]): Promise<string | null> {
    const { data, error } = await createClient().rpc("checkout_sale", {
      p_items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
      p_payments: payments.map((p) => ({ method: p.method, amount_cents: p.amountCents, received_cents: p.receivedCents })),
      p_discount_cents: discount,
      p_client_id: client?.id ?? null,
      p_channel: "presencial",
      p_require_session: true,
      p_origin: "pdv",
      p_allow_oversell: oversell,
    });
    if (error) {
      void reload(); // o estoque pode ter mudado em outro caixa
      return friendly(error.message);
    }
    const sale = data as { number: number; paid_at: string | null; created_at: string };
    setReceipt({
      number: sale.number,
      date: sale.paid_at ?? sale.created_at,
      operator: profile.full_name,
      client: client?.name,
      items: lines.map((l) => ({ name: l.product.name, qty: l.qty, unitCents: l.product.priceCents })),
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
      payments: payments.map((p) => ({
        method: p.method,
        amountCents: p.amountCents,
        receivedCents: p.receivedCents,
        changeCents: p.method === "dinheiro" ? Math.max(0, p.receivedCents - p.amountCents) : 0,
      })),
    });
    toast.success(`Venda #${String(sale.number).padStart(4, "0")} concluída: ${brl(total)}`);
    setCart({});
    setDiscountText("");
    setClient(null);
    setPayOpen(false);
    void reload();
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-nude-50">
      {/* Barra superior */}
      <header className="flex items-center gap-4 border-b border-nude-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ScanBarcode className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold text-brand-800">{settings.storeName}</p>
            <p className="text-[10px] tracking-[0.2em] text-gold-600 uppercase">PDV</p>
          </div>
        </div>
        <div className="ml-4 hidden text-xs text-ink-500 md:block">
          Caixa nº <strong className="text-ink-900">{session.number}</strong> · aberto às{" "}
          {new Date(session.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
          Operador: <strong className="text-ink-900">{profile.full_name}</strong>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void goHome()}>
            <House className="size-4" /> Início <kbd className="rounded bg-nude-100 px-1 text-[10px]">F1</kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHistOpen(true)}>
            <History className="size-4" /> Histórico <kbd className="rounded bg-nude-100 px-1 text-[10px]">F7</kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)}>
            <ArrowLeftRight className="size-4" /> Sangria/Suprimento <kbd className="rounded bg-nude-100 px-1 text-[10px]">F6</kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={openClose}>
            <Lock className="size-4" /> Fechar caixa <kbd className="rounded bg-nude-100 px-1 text-[10px]">F8</kbd>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNewBarcode("");
              setNewOpen(true);
            }}
          >
            <PackagePlus className="size-4" /> Novo produto <kbd className="rounded bg-nude-100 px-1 text-[10px]">F10</kbd>
          </Button>
          <IconButton aria-label="Sair" title="Sair" onClick={signOut}>
            <LogOut className="size-4" />
          </IconButton>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_26rem]">
        {/* Busca e produtos */}
        <section className="flex min-h-0 flex-col p-4">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Buscar por nome, SKU ou ler código de barras...  (F2)"
              className="h-14 pl-12 text-lg"
              aria-label="Buscar produto"
              autoComplete="off"
            />
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {status === "loading" ? (
              <p className="p-6 text-center text-ink-500">Carregando produtos...</p>
            ) : status === "error" ? (
              <EmptyState
                icon={ShoppingCart}
                title="Não foi possível carregar os produtos"
                description="Verifique a conexão com a internet."
                action={<Button onClick={() => void reload()}>Tentar novamente</Button>}
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="Nenhum produto cadastrado"
                description="Cadastre o primeiro produto para começar a vender."
                action={<Button onClick={() => setNewOpen(true)}>Novo produto</Button>}
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon={ScanBarcode}
                title="Nenhum produto encontrado"
                description="Confira o código ou cadastre o produto."
                action={
                  <Button
                    onClick={() => {
                      setNewBarcode(/^\d{4,}$/.test(q.trim()) ? q.trim() : "");
                      setNewOpen(true);
                    }}
                  >
                    Cadastrar produto
                  </Button>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p, i) => {
                  const out = p.stock === 0 && !canOverride;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => addProduct(p)}
                        disabled={out}
                        className={`flex h-full w-full gap-3 rounded-xl border bg-white p-2.5 text-left transition hover:border-brand-400 disabled:opacity-50 ${
                          i === active && q ? "border-brand-500 ring-2 ring-brand-200" : "border-nude-200"
                        }`}
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-nude-100 text-ink-400">
                            <ImageIcon className="size-6" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <p className="line-clamp-2 text-sm leading-snug font-medium text-ink-900">{p.name}</p>
                          <div className="flex items-end justify-between gap-2">
                            <span className="font-display text-lg font-semibold text-brand-700">{brl(p.priceCents)}</span>
                            <span className={`text-xs ${p.stock === 0 ? "font-semibold text-red-600" : p.stock <= 3 ? "text-gold-600" : "text-ink-500"}`}>
                              {p.stock === 0 ? "Sem estoque" : `${p.stock} un.`}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Carrinho */}
        <aside className="flex min-h-0 flex-col border-l border-nude-200 bg-white">
          <div className="flex items-center justify-between border-b border-nude-100 px-4 py-3">
            <h2 className="font-display text-lg font-semibold">Carrinho</h2>
            {lines.length > 0 && (
              <button onClick={() => setCart({})} className="text-xs text-ink-500 hover:text-red-600">
                Limpar
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Carrinho vazio" description="Leia um código de barras ou busque um produto." />
            ) : (
              <ul className="divide-y divide-nude-100">
                {lines.map(({ product, qty }) => (
                  <li key={product.id} className="px-4 py-3">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">{product.name}</p>
                      <span className="shrink-0 text-sm font-semibold">{brl(qty * product.priceCents)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-ink-500">
                        {brl(product.priceCents)} un.
                        {qty > product.stock && <span className="ml-2 font-medium text-red-600">acima do estoque</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <IconButton aria-label="Diminuir" onClick={() => setQty(product, qty - 1)}>
                          <Minus className="size-4" />
                        </IconButton>
                        <input
                          aria-label={`Quantidade de ${product.name}`}
                          inputMode="numeric"
                          value={qty}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isInteger(n)) setQty(product, n);
                          }}
                          className="h-8 w-12 rounded-lg border border-nude-300 text-center text-sm"
                        />
                        <IconButton aria-label="Aumentar" onClick={() => setQty(product, qty + 1)}>
                          <Plus className="size-4" />
                        </IconButton>
                        <IconButton aria-label={`Remover ${product.name}`} onClick={() => setQty(product, 0)} className="hover:text-red-600">
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-nude-200 bg-nude-50 p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setClientOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-nude-300 bg-white px-3 py-2 text-left text-sm hover:border-brand-400"
              >
                <UserRound className="size-4 shrink-0 text-brand-500" />
                <span className="truncate">{client ? client.name : "Cliente (opcional)"}</span>
                <kbd className="ml-auto rounded bg-nude-100 px-1 text-[10px] text-ink-500">F3</kbd>
              </button>
              {client && (
                <button onClick={() => setClient(null)} className="text-xs text-ink-500 hover:text-red-600">
                  Remover
                </button>
              )}
            </div>
            <div className="flex items-start gap-2">
              <label className="flex-1 text-xs text-ink-500">
                Desconto <kbd className="rounded bg-white px-1 text-[10px]">F4</kbd>
                <div className="mt-1 flex gap-2">
                  <Select
                    value={discountMode}
                    onChange={(e) => setDiscountMode(e.target.value as "valor" | "percent")}
                    className="w-20"
                    aria-label="Tipo de desconto"
                  >
                    <option value="valor">R$</option>
                    <option value="percent">%</option>
                  </Select>
                  <Input
                    ref={discountRef}
                    inputMode="decimal"
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    invalid={!!discountError}
                    placeholder="0"
                  />
                </div>
                {discountError && <span className="mt-1 block text-red-600">{discountError}</span>}
              </label>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Desconto</span>
                <span>− {brl(discountError ? 0 : discount)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium">Total</span>
                <span className="font-display text-4xl font-semibold text-brand-700">{brl(total)}</span>
              </div>
            </div>

            <Button className="h-14 w-full text-lg" onClick={openPayment} disabled={lines.length === 0 || !!discountError}>
              Finalizar venda <kbd className="rounded bg-white/20 px-1.5 text-xs">F9</kbd>
            </Button>
          </div>
        </aside>
      </div>

      <PaymentModal open={payOpen} totalCents={total} onClose={() => setPayOpen(false)} onConfirm={confirmPayment} />
      <ReceiptModal data={receipt} settings={settings} onClose={() => setReceipt(null)} />
      <HistoryModal open={histOpen} profile={profile} settings={settings} onClose={() => setHistOpen(false)} onChanged={() => void reload()} />
      <CashMovementModal open={moveOpen} sessionId={session.id} onClose={() => setMoveOpen(false)} />
      <CloseCashModal
        open={closeOpen}
        session={session}
        operator={profile.full_name}
        settings={settings}
        onClose={() => setCloseOpen(false)}
        onClosed={() => {
          setCloseOpen(false);
          onSessionClosed();
        }}
      />
      <ClientPicker open={clientOpen} onClose={() => setClientOpen(false)} onPick={setClient} />
      <NewProductModal
        open={newOpen}
        initialBarcode={newBarcode}
        onClose={() => setNewOpen(false)}
        onCreated={(name) => {
          setNewOpen(false);
          setQ(name);
          void reload();
        }}
      />
    </div>
  );
}
