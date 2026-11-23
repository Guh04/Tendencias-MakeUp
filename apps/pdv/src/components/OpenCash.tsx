"use client";

import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendly, parseCents } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Card } from "@tendencias/ui/card";
import { Field, Input, Textarea } from "@tendencias/ui/form";

export function OpenCash({ onOpened }: { onOpened: () => void }) {
  const { state, signOut } = useAuth();
  const toast = useToast();
  const [now, setNow] = useState(() => new Date());
  const [amount, setAmount] = useState("0,00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-nude-50 via-white to-brand-50 px-4">
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Lock className="size-7" />
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900">Abertura de caixa</h1>
          <p className="mt-1 text-sm text-ink-500">Abra o caixa para começar a vender.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} noValidate className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-nude-100 p-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">Operador</dt>
                <dd className="font-medium text-ink-900">{state.profile?.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Data e horário</dt>
                <dd className="font-medium text-ink-900">
                  {now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              <LockOpen className="size-5" /> {busy ? "Abrindo..." : "Abrir caixa"}
            </Button>
          </form>
        </Card>
        <button onClick={signOut} className="mx-auto mt-4 block text-sm text-ink-500 hover:text-brand-700">
          Sair
        </button>
      </div>
    </div>
  );
}
