"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Info, Lock, Menu, Sparkles } from "lucide-react";
import { useAppState, useHydrated } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "./Sidebar";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50">
      <div className="flex flex-col items-center gap-3 text-brand-500">
        <Sparkles className="size-8 animate-pulse" />
        <p className="font-display text-lg">Carregando...</p>
      </div>
    </div>
  );
}

function AccessDenied({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50 px-4">
      <div className="max-w-sm rounded-2xl border border-nude-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold text-ink-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
        <Button className="mt-5 w-full" variant="secondary" onClick={onSignOut}>
          Sair
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const state = useAppState();
  const { state: auth, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  // Os dados vêm do LocalStorage (até a migração para o banco): só renderiza após hidratar.
  if (!hydrated || auth.status === "loading") return <Splash />;

  if (auth.status !== "ready")
    return <AccessDenied message="Sua sessão não é válida. Entre novamente." onSignOut={signOut} />;
  if (!auth.profile.active)
    return <AccessDenied message="Seu usuário está desativado. Fale com o administrador da loja." onSignOut={signOut} />;
  if (auth.profile.role !== "admin")
    return (
      <AccessDenied
        message="O painel administrativo é exclusivo para administradores. Use o aplicativo do PDV para operar o caixa."
        onSignOut={signOut}
      />
    );

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-nude-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-ink-700 hover:bg-nude-100"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-display text-lg font-semibold text-brand-800">
            {state.settings.storeName}
          </span>
        </header>

        {state.isDemo && (
          <div className="flex items-start gap-2 border-b border-gold-300 bg-gold-300/20 px-4 py-2 text-xs text-ink-700 sm:items-center lg:px-8">
            <Info className="mt-0.5 size-4 shrink-0 text-gold-600 sm:mt-0" />
            <p>
              <strong>Dados de demonstração:</strong> as telas de produtos, vendas, clientes e
              financeiro ainda usam dados fictícios salvos neste navegador. Eles serão conectados ao
              banco central na próxima etapa.
            </p>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
