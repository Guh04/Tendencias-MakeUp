"use client";

import { Lock, ScanBarcode } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCashSession } from "@/hooks/useCashSession";
import { OpenCash } from "@/components/OpenCash";
import { SaleScreen } from "@/components/SaleScreen";
import { Button } from "@tendencias/ui/button";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50">
      <div className="flex flex-col items-center gap-3 text-brand-500">
        <ScanBarcode className="size-8 animate-pulse" />
        <p className="font-display text-lg">Carregando...</p>
      </div>
    </div>
  );
}

function Denied({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50 px-4">
      <div className="max-w-sm rounded-2xl border border-nude-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
        <Button className="mt-5 w-full" variant="secondary" onClick={onSignOut}>
          Sair
        </Button>
      </div>
    </div>
  );
}

export default function PdvPage() {
  const { state, signOut } = useAuth();
  const profile = state.status === "ready" && state.profile.active ? state.profile : null;
  const cash = useCashSession(profile?.id ?? null);

  if (state.status === "loading") return <Splash />;
  if (state.status !== "ready") return <Denied message="Sua sessão não é válida. Entre novamente." onSignOut={signOut} />;
  if (!state.profile.active)
    return <Denied message="Seu usuário está desativado. Fale com o administrador da loja." onSignOut={signOut} />;
  if (cash.loading) return <Splash />;
  if (!cash.session) return <OpenCash onOpened={() => void cash.refresh()} />;
  return <SaleScreen session={cash.session} profile={state.profile} />;
}
