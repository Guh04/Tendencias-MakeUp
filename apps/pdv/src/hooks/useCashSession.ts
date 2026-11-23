"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashSession } from "@/lib/types";

interface Row {
  id: string;
  number: number;
  opened_at: string;
  opening_cents: number;
}

/** Caixa aberto do operador logado (no maximo um por operador, garantido pelo banco). */
export function useCashSession(userId: string | null) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await createClient()
      .from("cash_sessions")
      .select("id, number, opened_at, opening_cents")
      .eq("opened_by", userId)
      .eq("status", "aberto")
      .maybeSingle();
    const row = data as Row | null;
    setSession(row ? { id: row.id, number: row.number, openedAt: row.opened_at, openingCents: row.opening_cents } : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { session, loading, refresh };
}
