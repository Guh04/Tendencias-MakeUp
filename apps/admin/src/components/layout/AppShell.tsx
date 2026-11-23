"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloudOff, Lock, Menu, Sparkles } from "lucide-react";
import { reload, startStore, stopStore, useAppState, useDataStatus } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "./Sidebar";

function Splash({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50">
      <div className="flex flex-col items-center gap-3 text-brand-500">
        <Sparkles className="size-8 animate-pulse" />
        <p className="font-display text-lg">{label}</p>
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  message,
  children,
}: {
  icon: typeof Lock;
  title: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nude-50 px-4">
      <div className="max-w-sm rounded-2xl border border-nude-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
        <div className="mt-5 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useAppState();
  const data = useDataStatus();
  const { state: auth, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = auth.status === "ready" && auth.profile.active && auth.profile.role === "admin";

  // Carrega os dados do banco somente para administradores logados.
  useEffect(() => {
    if (isAdmin) startStore();
    else stopStore();
  }, [isAdmin]);

  const signedOut = auth.status === "signed-out" && pathname !== "/login";
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (pathname === "/login") return <>{children}</>;
  if (auth.status === "loading" || signedOut) return <Splash />;

  if (auth.status !== "ready")
    return (
      <Notice icon={Lock} title="Acesso restrito" message="Sua sessão não é válida. Entre novamente.">
        <Button variant="secondary" onClick={signOut}>
          Sair
        </Button>
      </Notice>
    );
  if (!auth.profile.active)
    return (
      <Notice icon={Lock} title="Acesso restrito" message="Seu usuário está desativado. Fale com o administrador da loja.">
        <Button variant="secondary" onClick={signOut}>
          Sair
        </Button>
      </Notice>
    );
  if (auth.profile.role !== "admin")
    return (
      <Notice
        icon={Lock}
        title="Acesso restrito"
        message="O painel administrativo é exclusivo para administradores. Use o aplicativo do PDV para operar o caixa."
      >
        <Button variant="secondary" onClick={signOut}>
          Sair
        </Button>
      </Notice>
    );

  if (data.status === "error")
    return (
      <Notice icon={CloudOff} title="Não foi possível carregar os dados" message={data.error || "Verifique a conexão com a internet."}>
        <Button onClick={() => void reload()}>Tentar novamente</Button>
        <Button variant="ghost" onClick={signOut}>
          Sair
        </Button>
      </Notice>
    );
  if (data.status !== "ready") return <Splash label="Carregando dados da loja..." />;

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
          <span className="font-display text-lg font-semibold text-brand-800">{state.settings.storeName}</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
