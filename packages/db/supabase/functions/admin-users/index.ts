// Funcao segura: criar usuario e redefinir senha. A chave secreta fica SOMENTE aqui (servidor do Supabase),
// nunca no computador da loja. Antes de agir, confirma que quem chamou e um administrador ativo.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = Deno.env.get("ADMIN_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) quem chamou?
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await caller.auth.getUser();
  if (!u.user) return json({ ok: false, error: "Sessão inválida." }, 401);
  const { data: prof } = await caller.from("profiles").select("role, active").eq("id", u.user.id).maybeSingle();
  if (!(prof?.role === "admin" && prof.active)) return json({ ok: false, error: "Somente administradores podem fazer isso." }, 403);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Requisição inválida." }, 400);
  }

  if (body.action === "create") {
    const fullName = (body.fullName ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    if (fullName.length < 2) return json({ ok: false, error: "Informe o nome." });
    if (!isEmail(email)) return json({ ok: false, error: "E-mail inválido." });
    if ((body.password ?? "").length < 8) return json({ ok: false, error: "A senha deve ter ao menos 8 caracteres." });
    if (body.role !== "admin" && body.role !== "operator") return json({ ok: false, error: "Perfil inválido." });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      app_metadata: { role: body.role },
      user_metadata: { full_name: fullName },
    });
    if (error) {
      const dup = /already|registered|exists/i.test(error.message);
      return json({ ok: false, error: dup ? "Já existe um usuário com este e-mail." : "Não foi possível criar o usuário." });
    }
    await admin.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
    await admin.from("audit_logs").insert({ user_id: u.user.id, action: "usuario_criado", entity: "profiles", entity_id: data.user.id, details: { email, perfil: body.role } });
    return json({ ok: true });
  }

  if (body.action === "reset") {
    if ((body.password ?? "").length < 8) return json({ ok: false, error: "A senha deve ter ao menos 8 caracteres." });
    const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
    if (error) return json({ ok: false, error: "Não foi possível redefinir a senha." });
    await admin.from("audit_logs").insert({ user_id: u.user.id, action: "senha_redefinida", entity: "profiles", entity_id: body.userId, details: {} });
    return json({ ok: true });
  }

  return json({ ok: false, error: "Ação desconhecida." }, 400);
});
