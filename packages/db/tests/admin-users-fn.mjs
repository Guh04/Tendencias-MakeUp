// Testa a Edge Function admin-users no Supabase real. Cria usuarios qa-* e remove todos no final (sem rastros).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../../../apps/admin/.env.local"), "utf8")
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, opts);
const stamp = Date.now();
const password = `Qa-${stamp}-Ff!8`;
const created = [];
let fails = 0;
const ok = (n, c, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"} ${n} ${c ? "" : x}`); if (!c) fails++; };

async function makeUser(tag, role) {
  const email = `qa-fn-${tag}-${stamp}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role }, user_metadata: { full_name: `QA ${tag}` } });
  if (error) throw new Error(error.message);
  created.push(data.user.id);
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(e2.message);
  return { c, id: data.user.id, email };
}
const call = (c, body) => c.functions.invoke("admin-users", { body });

try {
  const admin = await makeUser("admin", "admin");
  const op = await makeUser("op", "operator");

  const newEmail = `qa-fn-novo-${stamp}@example.com`;
  const r1 = await call(admin.c, { action: "create", fullName: "Novo Operador QA", email: newEmail, password: "SenhaForte123", role: "operator" });
  ok("administrador cria usuario", r1.data?.ok === true, JSON.stringify(r1.data ?? r1.error?.message));
  const { data: found } = await service.from("profiles").select("id, full_name, role, active").eq("full_name", "Novo Operador QA").maybeSingle();
  if (found) created.push(found.id);
  ok("perfil criado como operador ativo com o nome informado", found?.role === "operator" && found.active === true);

  const r2 = await call(admin.c, { action: "create", fullName: "Dup", email: newEmail, password: "SenhaForte123", role: "operator" });
  ok("e-mail duplicado e recusado com mensagem clara", r2.data?.ok === false && /Já existe/.test(r2.data.error), JSON.stringify(r2.data));
  const r3 = await call(admin.c, { action: "create", fullName: "X", email: "invalido", password: "123", role: "admin" });
  ok("dados invalidos sao recusados", r3.data?.ok === false);

  if (found) {
    const r4 = await call(admin.c, { action: "reset", userId: found.id, password: "OutraSenha456" });
    ok("administrador redefine senha", r4.data?.ok === true, JSON.stringify(r4.data));
    const login = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts).auth.signInWithPassword({ email: newEmail, password: "OutraSenha456" });
    ok("usuario entra com a nova senha", !login.error, login.error?.message);
  }

  const r5 = await call(op.c, { action: "create", fullName: "Hack", email: `qa-fn-hack-${stamp}@example.com`, password: "SenhaForte123", role: "admin" });
  const denied = r5.error || r5.data?.ok === false;
  ok("operador NAO consegue criar usuario", !!denied && !r5.data?.ok, JSON.stringify(r5.data ?? r5.error?.message));
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const r6 = await call(anon, { action: "create", fullName: "Anon", email: `qa-fn-anon-${stamp}@example.com`, password: "SenhaForte123", role: "admin" });
  ok("visitante sem login NAO consegue", !!(r6.error || r6.data?.ok === false) && !r6.data?.ok);
  const { data: leak } = await service.from("profiles").select("id").like("full_name", "Hack");
  ok("nenhum usuario indevido foi criado", (leak ?? []).length === 0);
} finally {
  for (const id of created) await service.auth.admin.deleteUser(id);
  console.log(`  ${created.length} usuario(s) de teste removido(s)`);
}
console.log(fails ? `\n${fails} FALHA(S)` : "\nFuncao admin-users OK.");
process.exitCode = fails ? 1 : 0;
