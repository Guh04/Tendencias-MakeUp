"use client";

import { useState } from "react";
import type { PaymentMethod, Sale } from "@tendencias/core/types";
import { PAYMENT_LABELS, PAYMENT_METHODS, formatBRL, round2 } from "@tendencias/core/format";
import { actions } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

export function ReturnModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  return (
    <Modal open={!!sale} onClose={onClose} title="Devolução de itens" size="md">
      {sale && <ReturnForm key={sale.id} sale={sale} onClose={onClose} />}
    </Modal>
  );
}

function ReturnForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const toast = useToast();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const returnable = sale.items.filter((i) => i.qty - i.returnedQty > 0);
  const selected = returnable.filter((i) => (qtys[i.id] ?? 0) > 0);
  // estimativa; o valor exato (proporcional ao desconto) e calculado pelo banco
  const estimate = round2(returnable.reduce((s, i) => s + ((qtys[i.id] ?? 0) * i.unitPrice * sale.total) / sale.subtotal, 0));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (selected.length === 0) return setError("Selecione ao menos um item e a quantidade.");
    if (reason.trim().length < 3) return setError("Informe o motivo da devolução.");
    setBusy(true);
    const res = await actions.registerReturn(
      sale.id,
      selected.map((i) => ({ saleItemId: i.id, qty: qtys[i.id], restock: restock[i.id] ?? true })),
      reason.trim(),
      method,
    );
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success("Devolução registrada.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ul className="divide-y divide-nude-100 rounded-xl border border-nude-200">
        {returnable.map((i) => {
          const max = i.qty - i.returnedQty;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-ink-500">
                  {formatBRL(i.unitPrice)} · pode devolver até {max}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs text-ink-500">
                <input
                  type="checkbox"
                  checked={restock[i.id] ?? true}
                  onChange={(e) => setRestock((r) => ({ ...r, [i.id]: e.target.checked }))}
                  className="accent-brand-600"
                />
                voltar ao estoque
              </label>
              <Select
                value={qtys[i.id] ?? 0}
                onChange={(e) => {
                  setQtys((q) => ({ ...q, [i.id]: Number(e.target.value) }));
                  setError("");
                }}
                className="h-9 w-20"
                aria-label={`Quantidade a devolver de ${i.name}`}
              >
                {Array.from({ length: max + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Devolver o valor em" required hint={method === "dinheiro" ? "Dinheiro exige um caixa aberto no seu usuário (no PDV)." : undefined}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-xl bg-brand-50 p-3 text-center">
          <p className="text-xs text-ink-500">Reembolso estimado</p>
          <p className="font-display text-2xl font-semibold text-brand-700">{formatBRL(estimate)}</p>
        </div>
      </div>
      <Field label="Motivo" required error={error}>
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError("");
          }}
          invalid={!!error}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Registrando..." : "Registrar devolução"}
        </Button>
      </div>
    </form>
  );
}
