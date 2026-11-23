"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@tendencias/core/validation";
import { Button } from "@tendencias/ui/button";
import { Field, Input } from "@tendencias/ui/form";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!isValidEmail(email)) return setError("Informe um e-mail válido.");
    if (!password) return setError("Informe a senha.");
    setBusy(true);
    setError("");
    const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      setError("E-mail ou senha incorretos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-nude-50 via-white to-brand-50 px-4">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white ring-2 ring-gold-300 ring-offset-2">
            <ScanBarcode className="size-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-brand-800">Tendencias MakeUp</h1>
          <p className="text-[11px] tracking-[0.25em] text-gold-600 uppercase">PDV · Ponto de venda</p>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-nude-200 bg-white p-6 shadow-soft">
          <Field label="E-mail">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Senha">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
