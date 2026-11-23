"use server";

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { isValidEmail } from "@tendencias/core/validation";

type Result = { ok: true } | { ok: false; error: string };

/** Garante que quem chama e um administrador ATIVO (lido do banco com o RLS do proprio usuario). */
async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", id).maybeSingle();
  return profile?.role === "admin" && profile.active ? { id } : null;
}

export async function createUserAction(input: {
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "operator";
}): Promise<Result> {
  const caller = await requireAdmin();
  if (!caller) return { ok: false, error: "Somente administradores podem criar usuários." };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2) return { ok: false, error: "Informe o nome." };
  if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
  if (input.password.length < 8) return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };
  if (input.role !== "admin" && input.role !== "operator") return { ok: false, error: "Perfil inválido." };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: fullName },
  });
  if (error) {
    const dup = /already|registered|exists/i.test(error.message);
    return { ok: false, error: dup ? "Já existe um usuário com este e-mail." : "Não foi possível criar o usuário." };
  }
  // o gatilho cria o perfil com o nome do e-mail; ajusta para o nome informado
  await service.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
  await service.from("audit_logs").insert({
    user_id: caller.id,
    action: "usuario_criado",
    entity: "profiles",
    entity_id: data.user.id,
    details: { email, perfil: input.role },
  });
  return { ok: true };
}

export async function resetPasswordAction(userId: string, newPassword: string): Promise<Result> {
  const caller = await requireAdmin();
  if (!caller) return { ok: false, error: "Somente administradores podem redefinir senhas." };
  if (newPassword.length < 8) return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { ok: false, error: "Não foi possível redefinir a senha." };
  await service.from("audit_logs").insert({
    user_id: caller.id,
    action: "senha_redefinida",
    entity: "profiles",
    entity_id: userId,
    details: {},
  });
  return { ok: true };
}
