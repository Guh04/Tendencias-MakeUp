"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Minus, Plus, QrCode, ShoppingCart, Trash2 } from "lucide-react";
import type { PaymentMethod, Sale } from "@tendencias/core/types";
import {
  CATEGORIES,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  formatBRL,
  parseNumber,
  round2,
} from "@tendencias/core/format";
import { actions, useAppState } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, SearchInput } from "@/components/ui/Form";
import { SaleDetail } from "./SaleDetail";

const PAY_ICONS: Record<PaymentMethod, typeof Banknote> = {
  dinheiro: Banknote,
  pix: QrCode,
  credito: CreditCard,
  debito: Landmark,
};

export function PointOfSale() {
  const state = useAppState();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [clientId, setClientId] = useState("");
  const [discountMode, setDiscountMode] = useState<"valor" | "percent">("valor");
  const [discountText, setDiscountText] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>(state.settings.defaultPayment);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const products = state.products;

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const lines = useMemo(
    () =>
      Object.entries(cart).flatMap(([id, qty]) => {
        const product = products.find((p) => p.id === id);
        return product ? [{ product, qty }] : [];
      }),
    [cart, products],
  );

  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.product.salePrice, 0));

  let discount = 0;
  let discountError = "";
  if (discountText.trim()) {
    const v = parseNumber(discountText);
    if (!Number.isFinite(v) || v < 0) discountError = "Desconto inválido.";
    else if (discountMode === "percent") {
      if (v > 100) discountError = "O desconto não pode passar de 100%.";
      else discount = round2((subtotal * v) / 100);
    } else {
      if (v > subtotal) discountError = "O desconto não pode ser maior que o subtotal.";
      else discount = round2(v);
    }
  }
  const total = round2(subtotal - discount);

  function setQty(id: string, qty: number) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    if (qty <= 0) {
      setCart((c) => {
        const { [id]: removed, ...rest } = c;
        void removed;
        return rest;
      });
      return;
    }
    if (qty > product.stock) {
      toast.error(`Estoque insuficiente: "${product.name}" tem apenas ${product.stock} unidade(s).`);
      qty = product.stock;
      if (qty === 0) return;
    }
    setCart((c) => ({ ...c, [id]: qty }));
  }

  function add(id: string) {
    setQty(id, (cart[id] ?? 0) + 1);
  }

  function finalize() {
    if (discountError) {
      toast.error(discountError);
      return;
    }
    const res = actions.finalizeSale({
      items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      discount,
      payment,
      clientId: clientId || null,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Venda #${String(res.data.number).padStart(4, "0")} finalizada: ${formatBRL(res.data.total)}.`);
    setReceipt(res.data);
    setCart({});
    setDiscountText("");
    setClientId("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader title="Produtos" subtitle="Clique para adicionar ao carrinho" />
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto ou SKU" className="min-w-48 flex-1" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-48" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        {products.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sem produtos" description="Cadastre produtos para poder vender." />
        ) : catalog.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Nenhum produto encontrado" />
        ) : (
          <div className="grid max-h-[34rem] grid-cols-1 gap-3 overflow-y-auto p-4 pt-0 sm:grid-cols-2 2xl:grid-cols-3">
            {catalog.map((p) => {
              const inCart = cart[p.id] ?? 0;
              const out = p.stock === 0;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  disabled={out || inCart >= p.stock}
                  className="rounded-xl border border-nude-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="line-clamp-2 min-h-10 text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="mt-1 text-xs text-ink-500">{p.category}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold text-brand-700">{formatBRL(p.salePrice)}</span>
                    {out ? (
                      <Badge tone="red">Esgotado</Badge>
                    ) : (
                      <span className="text-xs text-ink-500">
                        {inCart > 0 ? `${inCart} no carrinho · ` : ""}
                        {p.stock} em estoque
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader
          title="Carrinho"
          subtitle={lines.length ? `${lines.length} item(ns)` : undefined}
          action={
            lines.length > 0 ? (
              <button className="text-xs text-ink-500 hover:text-red-600" onClick={() => setCart({})}>
                Limpar
              </button>
            ) : undefined
          }
        />
        {lines.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Carrinho vazio" description="Selecione produtos ao lado para iniciar uma venda." />
        ) : (
          <div className="space-y-4 p-4">
            <ul className="max-h-64 space-y-3 overflow-y-auto">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-ink-500">
                      {formatBRL(product.salePrice)} · {formatBRL(qty * product.salePrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton aria-label="Diminuir quantidade" onClick={() => setQty(product.id, qty - 1)}>
                      <Minus className="size-3.5" />
                    </IconButton>
                    <input
                      aria-label={`Quantidade de ${product.name}`}
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n)) setQty(product.id, n);
                      }}
                      className="h-8 w-10 rounded-lg border border-nude-300 text-center text-sm"
                    />
                    <IconButton aria-label="Aumentar quantidade" onClick={() => setQty(product.id, qty + 1)}>
                      <Plus className="size-3.5" />
                    </IconButton>
                    <IconButton aria-label={`Remover ${product.name}`} onClick={() => setQty(product.id, 0)} className="hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>

            <Field label="Cliente (opcional)">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Cliente não identificado</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Desconto" error={discountError}>
              <div className="flex gap-2">
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
                  inputMode="decimal"
                  placeholder="0"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value)}
                  invalid={!!discountError}
                />
              </div>
            </Field>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-700">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = PAY_ICONS[m];
                  return (
                    <button
                      key={m}
                      onClick={() => setPayment(m)}
                      aria-pressed={payment === m}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                        payment === m
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-nude-300 text-ink-700 hover:bg-nude-100"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      {PAYMENT_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 border-t border-nude-100 pt-3 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Desconto</span>
                <span>− {formatBRL(discount)}</span>
              </div>
              <div className="flex justify-between font-display text-xl font-semibold text-brand-700">
                <span>Total</span>
                <span>{formatBRL(total)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={finalize} disabled={!!discountError}>
              Finalizar venda
            </Button>
          </div>
        )}
      </Card>

      <SaleDetail sale={receipt} onClose={() => setReceipt(null)} justFinished />
    </div>
  );
}
