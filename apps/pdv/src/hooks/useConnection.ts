"use client";

import { useEffect, useState } from "react";

/**
 * Detecta se ha internet de verdade (o Windows pode dizer "conectado" sem acesso).
 * Faz um teste leve no servidor a cada 15 s e reage na hora aos eventos de rede.
 * Qualquer resposta do servidor (mesmo erro HTTP) conta como conectado; so falha de rede conta como sem conexao.
 */
export function useConnection(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let stopped = false;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`;

    async function probe() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (!stopped) setOnline(false);
        return;
      }
      try {
        await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(6000) });
        if (!stopped) setOnline(true);
      } catch {
        if (!stopped) setOnline(false);
      }
    }

    const onOffline = () => setOnline(false);
    const onOnline = () => void probe();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const first = setTimeout(() => void probe(), 0);
    const timer = setInterval(() => void probe(), 15000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return online;
}
