"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, friendly, parseCents } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Field, Input } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

type Kind = "suprimento" | "sangria";

export function CashMovementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Movimentação de caixa" size="sm">
      {open && <Body onClose={onClose} />}
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("sangria");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const cents = parseCents(amount);
    const e: { amount?: string; reason?: string } = {};
    if (!Number.isFinite(cents) || cents <= 0) e.amount = "Informe um valor maior que zero.";
    if (reason.trim().length < 3) e.reason = "Informe o motivo.";
    setErrors(e);
    if (e.amount || e.reason) return;
    setBusy(true);
    const { error } = await createClient().rpc("add_cash_movement", { p_type: kind, p_amount_cents: cents, p_reason: reason.trim() });
    setBusy(false);
    if (error) return toast.error(friendly(error.message));
    toast.success(`${kind === "sangria" ? "Retirada" : "Entrada"} de ${brl(cents)} registrada.`);
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["sangria", "Retirada (sangria)", ArrowUpFromLine],
            ["suprimento", "Entrada (suprimento)", ArrowDownToLine],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-xs font-medium ${
              kind === k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-nude-300 text-ink-700 hover:bg-nude-100"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
      <Field label="Valor em dinheiro (R$)" required error={errors.amount}>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!errors.amount} autoFocus placeholder="0,00" />
      </Field>
      <Field label="Motivo" required error={errors.reason}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!errors.reason} placeholder={kind === "sangria" ? "Ex.: depósito no banco" : "Ex.: reforço de troco"} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Registrando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
