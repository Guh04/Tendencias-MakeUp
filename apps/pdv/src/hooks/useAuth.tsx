"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  full_name: string;
  role: "admin" | "operator";
  active: boolean;
  can_cancel_sales: boolean;
  can_refund: boolean;
  can_override_stock: boolean;
}

type AuthState =
  | { status: "loading"; profile: null }
  | { status: "signed-out"; profile: null }
  | { status: "ready"; profile: Profile };

interface AuthApi {
  state: AuthState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading", profile: null });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setState({ status: "signed-out", profile: null });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, active, can_cancel_sales, can_refund, can_override_stock")
        .eq("id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      setState(profile ? { status: "ready", profile: profile as Profile } : { status: "signed-out", profile: null });
    }

    void load();
    // Nao chamar o Supabase dentro do callback (trava o bloqueio interno do cliente): adia.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
        setTimeout(() => void load(), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setState({ status: "signed-out", profile: null });
    router.replace("/login");
  }, [router]);

  const api = useMemo(() => ({ state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider ausente");
  return ctx;
}
