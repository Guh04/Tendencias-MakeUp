"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, friendly, parseCents } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Field, Input } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

type Kind = "suprimento" | "sangria";

interface Movement {
  id: string;
  type: "suprimento" | "sangria" | "devolucao";
  amount_cents: number;
  reason: string;
  created_at: string;
  reverses_id: string | null;
}

const TYPE_LABEL = { suprimento: "Entrada", sangria: "Retirada", devolucao: "Devolução" } as const;

export function CashMovementModal({ open, sessionId, onClose }: { open: boolean; sessionId: string; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Movimentação de caixa" size="sm">
      {open && <Body sessionId={sessionId} onClose={onClose} />}
    </Modal>
  );
}

function Body({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("sangria");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState<Movement[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("cash_movements")
      .select("id, type, amount_cents, reason, created_at, reverses_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setMoves((data ?? []) as Movement[]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, tick]);

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
    setAmount("");
    setReason("");
    setTick((t) => t + 1);
  }

  return (
    <div className="space-y-4">
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Registrando..." : "Registrar"}
          </Button>
        </div>
      </form>

      <div className="border-t border-nude-100 pt-3">
        <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">Movimentações deste caixa</p>
        {!moves ? (
          <p className="text-sm text-ink-400">Carregando...</p>
        ) : moves.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="max-h-48 divide-y divide-nude-100 overflow-y-auto text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="font-medium">{TYPE_LABEL[m.type]}</span>{" "}
                  <span className="text-ink-500">· {m.reason}</span>
                  <span className="block text-xs text-ink-400">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {m.reverses_id && " · estorno"}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold ${m.type === "suprimento" ? "text-emerald-700" : "text-red-600"}`}>
                  {m.type === "suprimento" ? "+" : "−"} {brl(m.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-400">
          Lançou algo errado? Registre o lançamento contrário, ou peça a um administrador para estornar.
        </p>
      </div>
    </div>
  );
}
