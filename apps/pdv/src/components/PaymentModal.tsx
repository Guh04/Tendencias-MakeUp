"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode, X } from "lucide-react";
import type { PaymentMethod } from "@tendencias/core/types";
import { PAYMENT_LABELS } from "@tendencias/core/format";
import { brl, centsToText, parseCents } from "@/lib/money";
import { Button } from "@tendencias/ui/button";
import { Input } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

const METHODS: { method: PaymentMethod; icon: typeof Banknote }[] = [
  { method: "dinheiro", icon: Banknote },
  { method: "pix", icon: QrCode },
  { method: "debito", icon: Landmark },
  { method: "credito", icon: CreditCard },
];

export interface PaymentLine {
  method: PaymentMethod;
  amountCents: number;
  receivedCents: number;
}

interface Line {
  key: number;
  method: PaymentMethod;
  amount: string;
  received: string;
}

export function PaymentModal({
  open,
  totalCents,
  onClose,
  onConfirm,
}: {
  open: boolean;
  totalCents: number;
  onClose: () => void;
  /** Retorna mensagem de erro, ou null se a venda foi concluida. */
  onConfirm: (payments: PaymentLine[]) => Promise<string | null>;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Pagamento" size="md">
      {open && <Body key={totalCents} totalCents={totalCents} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  );
}

function Body({
  totalCents,
  onClose,
  onConfirm,
}: {
  totalCents: number;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[]) => Promise<string | null>;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const parsed = lines.map((l) => {
    const amount = parseCents(l.amount);
    const received = l.method === "dinheiro" ? (l.received.trim() ? parseCents(l.received) : amount) : amount;
    return { l, amount, received };
  });
  const paid = parsed.reduce((s, p) => s + (Number.isFinite(p.amount) && p.amount > 0 ? p.amount : 0), 0);
  const remaining = totalCents - paid;
  const change = parsed.reduce(
    (s, p) => (p.l.method === "dinheiro" && Number.isFinite(p.received) && p.received > p.amount ? s + (p.received - p.amount) : s),
    0,
  );
  const lineErrors = parsed.map((p) => {
    if (!Number.isFinite(p.amount) || p.amount <= 0) return "Informe o valor.";
    if (p.l.method === "dinheiro" && (!Number.isFinite(p.received) || p.received < p.amount)) return "Valor recebido menor que o valor a pagar.";
    return "";
  });
  const valid = lines.length > 0 && remaining === 0 && lineErrors.every((e) => !e);

  function add(method: PaymentMethod) {
    setServerError("");
    setLines((ls) => [...ls, { key: nextKey, method, amount: remaining > 0 ? centsToText(remaining) : "", received: "" }]);
    setNextKey((k) => k + 1);
  }
  // atalhos 1-4 escolhem a forma de pagamento (fora dos campos de texto)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const i = ["1", "2", "3", "4"].indexOf(e.key);
      if (i >= 0 && !(remaining <= 0 && lines.length > 0)) add(METHODS[i].method);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, lines.length, nextKey]);

  const patch = (key: number, p: Partial<Line>) => {
    setServerError("");
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  };

  async function confirm() {
    if (!valid || busy) return;
    setBusy(true);
    const err = await onConfirm(parsed.map((p) => ({ method: p.l.method, amountCents: p.amount, receivedCents: p.received })));
    setBusy(false);
    if (err) setServerError(err);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
      className="space-y-4"
    >
      <div className="rounded-xl bg-brand-50 p-4 text-center">
        <p className="text-xs tracking-wide text-ink-500 uppercase">Total a pagar</p>
        <p className="font-display text-4xl font-semibold text-brand-700">{brl(totalCents)}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-700">
          {lines.length ? "Adicionar outra forma (pagamento dividido)" : "Forma de pagamento"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map(({ method, icon: Icon }, i) => (
            <button
              key={method}
              type="button"
              onClick={() => add(method)}
              disabled={remaining <= 0 && lines.length > 0}
              className="flex flex-col items-center gap-1 rounded-xl border border-nude-300 px-2 py-3 text-xs font-medium text-ink-700 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-40"
            >
              <Icon className="size-5 text-brand-500" />
              {PAYMENT_LABELS[method].replace("Cartão de ", "")}
              <kbd className="text-[10px] text-ink-400">{i + 1}</kbd>
            </button>
          ))}
        </div>
      </div>

      {parsed.map(({ l }, idx) => (
        <div key={l.key} className="rounded-xl border border-nude-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-900">{PAYMENT_LABELS[l.method]}</span>
            <button
              type="button"
              onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
              className="rounded p-1 text-ink-400 hover:bg-nude-100 hover:text-red-600"
              aria-label={`Remover ${PAYMENT_LABELS[l.method]}`}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-500">
              Valor (R$)
              <Input
                inputMode="decimal"
                value={l.amount}
                onChange={(e) => patch(l.key, { amount: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                autoFocus={idx === lines.length - 1}
                className="mt-1"
              />
            </label>
            {l.method === "dinheiro" && (
              <label className="text-xs text-ink-500">
                Valor recebido (R$)
                <Input
                  inputMode="decimal"
                  value={l.received}
                  onChange={(e) => patch(l.key, { received: e.target.value })}
                  placeholder={l.amount}
                  className="mt-1"
                />
              </label>
            )}
          </div>
          {lineErrors[idx] && l.amount !== "" && <p className="mt-1 text-xs text-red-600">{lineErrors[idx]}</p>}
        </div>
      ))}

      {lines.length > 0 && (
        <div className="space-y-1 rounded-xl bg-nude-100 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Pago</span>
            <span className="font-medium">{brl(paid)}</span>
          </div>
          <div className={`flex justify-between ${remaining > 0 ? "text-red-600" : remaining < 0 ? "text-red-600" : "text-ink-500"}`}>
            <span>{remaining < 0 ? "Excedente (reduza um valor)" : "Falta pagar"}</span>
            <span className="font-medium">{brl(Math.abs(remaining))}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between font-display text-xl font-semibold text-emerald-700">
              <span>Troco</span>
              <span>{brl(change)}</span>
            </div>
          )}
        </div>
      )}

      {serverError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Voltar
        </Button>
        <Button type="submit" className="h-11 px-6 text-base" disabled={!valid || busy}>
          {busy ? "Confirmando..." : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}
