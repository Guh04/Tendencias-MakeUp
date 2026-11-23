import { createClient } from "@/lib/supabase/client";

type Result = { ok: true } | { ok: false; error: string };

/** Chama a funcao segura do Supabase (a chave secreta nunca fica neste computador). */
async function call(body: Record<string, string>): Promise<Result> {
  const { data, error } = await createClient().functions.invoke("admin-users", { body });
  if (error || !data) return { ok: false, error: "Não foi possível concluir. Verifique a conexão com a internet." };
  return data as Result;
}

export const createUserAction = (input: { fullName: string; email: string; password: string; role: "admin" | "operator" }) =>
  call({ action: "create", ...input });

export const resetPasswordAction = (userId: string, password: string) => call({ action: "reset", userId, password });
