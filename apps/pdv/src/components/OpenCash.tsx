"use client";

import { useState } from "react";
import { LockOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendly, parseCents } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Field, Input, Textarea } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

export function OpenCashModal({
  open,
  operator,
  onClose,
  onOpened,
}: {
  open: boolean;
  operator: string;
  onClose: () => void;
  onOpened: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Abertura de caixa" size="sm">
      {open && <Body operator={operator} onClose={onClose} onOpened={onOpened} />}
    </Modal>
  );
}

function Body({ operator, onClose, onOpened }: { operator: string; onClose: () => void; onOpened: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("0,00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const cents = parseCents(amount);
    if (!Number.isFinite(cents) || cents < 0) return setError("Informe o valor do fundo de caixa (pode ser 0,00).");
    setBusy(true);
    const { error: err } = await createClient().rpc("open_cash_session", { p_opening_cents: cents, p_notes: notes.trim() });
    setBusy(false);
    if (err) return toast.error(friendly(err.message));
    toast.success("Caixa aberto. Boas vendas!");
    onOpened();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-nude-100 p-3 text-sm">
        <div>
          <dt className="text-xs text-ink-500">Operador</dt>
          <dd className="font-medium text-ink-900">{operator}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Data e horário</dt>
          <dd className="font-medium text-ink-900">
            {new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </dd>
        </div>
      </dl>
      <Field label="Fundo de caixa (dinheiro inicial, R$)" required error={error}>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
          }}
          invalid={!!error}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
        />
      </Field>
      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          <LockOpen className="size-4" /> {busy ? "Abrindo..." : "Abrir caixa"}
        </Button>
      </div>
    </form>
  );
}
