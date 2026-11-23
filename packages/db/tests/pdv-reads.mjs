// Leituras que o PDV faz como OPERADOR (sem criar dados). Cria e remove um usuario qa-* sem rastros.
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
const email = `qa-pdv-${stamp}@example.com`;
const password = `Qa-${stamp}-Pp!3`;
let fails = 0;
const ok = (n, c, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"} ${n} ${c ? "" : x}`); if (!c) fails++; };

const { data: u, error: ue } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "operator" }, user_metadata: { full_name: "QA PDV" } });
if (ue) throw new Error(ue.message);
try {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { error: le } = await db.auth.signInWithPassword({ email, password });
  if (le) throw new Error(le.message);

  const prof = await db.from("profiles").select("id, full_name, role, active, can_cancel_sales, can_refund, can_override_stock").eq("id", u.user.id).maybeSingle();
  ok("operador le o proprio perfil (ativo, sem permissoes extras)", prof.data?.role === "operator" && prof.data.active && !prof.data.can_cancel_sales && !prof.data.can_override_stock, JSON.stringify(prof.error ?? prof.data));

  const prods = await db.from("products").select("id, sku, barcode, name, category, price_cents, stock, image_url").eq("active", true).order("name").range(0, 999);
  ok("catalogo do PDV carrega (colunas sem custo)", !prods.error, prods.error?.message);

  const costs = await db.from("product_costs").select("*");
  ok("operador nao enxerga custos", !costs.error && (costs.data ?? []).length === 0);

  const st = await db.from("settings").select("store_name, phone, address, cnpj, max_operator_discount_pct").maybeSingle();
  ok("operador le configuracoes da loja", !st.error && !!st.data?.store_name, st.error?.message);

  const cs = await db.from("cash_sessions").select("id, number, opened_at, opening_cents").eq("opened_by", u.user.id).eq("status", "aberto").maybeSingle();
  ok("consulta de caixa aberto funciona (nenhum aberto)", !cs.error && cs.data === null, cs.error?.message);

  const upd = await db.from("settings").update({ store_name: "hack" }).eq("id", true).select();
  ok("operador nao altera configuracoes", (upd.data ?? []).length === 0);
  const adj = await db.rpc("adjust_stock", { p_product_id: "00000000-0000-0000-0000-000000000000", p_delta: 1, p_reason: "x", p_type: "entrada", p_origin: "pdv" });
  ok("operador nao ajusta estoque (so administrador)", !!adj.error && /administrador/i.test(adj.error.message), adj.error?.message);

  const ch = db.channel("qa-rt").on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {});
  const sub = await new Promise((res) => ch.subscribe((s) => (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(s) ? res(s) : null)));
  ok("operador assina atualizacoes em tempo real de produtos", sub === "SUBSCRIBED", String(sub));
  await db.removeChannel(ch);
} finally {
  const { error } = await service.auth.admin.deleteUser(u.user.id);
  console.log(error ? `  AVISO: nao removeu ${email}: ${error.message}` : "  usuario de teste removido");
}
console.log(fails ? `\n${fails} FALHA(S)` : "\nLeituras do PDV OK.");
process.exitCode = fails ? 1 : 0;
