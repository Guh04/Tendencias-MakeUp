// Valida as consultas das telas Caixas, Mov. de estoque, Atividades e da carga de vendas (com origem).
// Somente leituras; cria e remove um administrador qa-* sem rastros.
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
const email = `qa-p8-${stamp}@example.com`;
const password = `Qa-${stamp}-Hh!5`;
let fails = 0;
const ok = (n, c, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"} ${n} ${c ? "" : x}`); if (!c) fails++; };

const { data: u, error: ue } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "admin" }, user_metadata: { full_name: "QA P8" } });
if (ue) throw new Error(ue.message);
try {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { error: le } = await db.auth.signInWithPassword({ email, password });
  if (le) throw new Error(le.message);

  const cs = await db.from("cash_sessions").select("*, cash_movements(id, type, amount_cents, reason, created_at, reverses_id)").order("opened_at", { ascending: false }).limit(5);
  ok("Caixas: sessoes com movimentacoes embutidas", !cs.error, cs.error?.message);
  const sm = await db.from("stock_movements").select("id, type, qty, stock_after, origin, reason, created_by, created_at, products(name, sku)").order("created_at", { ascending: false }).limit(5);
  ok("Mov. de estoque: com produto embutido", !sm.error, sm.error?.message);
  const al = await db.from("audit_logs").select("id, user_id, action, entity, entity_id, details, created_at").order("created_at", { ascending: false }).limit(5);
  ok("Atividades: logs", !al.error, al.error?.message);
  const sales = await db.from("sales").select(
    "id, number, channel, origin, status, operator_id, client_id, subtotal_cents, discount_cents, total_cents, created_at, paid_at, cancel_reason, " +
    "sale_items(id, product_id, name, sku, qty, unit_price_cents, returned_qty, sale_item_costs(unit_cost_cents)), " +
    "sale_payments(method, amount_cents, received_cents, change_cents), returns(refund_cents)").limit(5);
  ok("Carga de vendas com origem e id do item", !sales.error, sales.error?.message);
  const rv = await db.rpc("reverse_cash_movement", { p_movement_id: "00000000-0000-0000-0000-000000000000", p_reason: "teste" });
  ok("estorno: administrador chega na validacao (movimentacao inexistente)", !!rv.error && /não encontrada/i.test(rv.error.message), rv.error?.message);
} finally {
  const { error } = await service.auth.admin.deleteUser(u.user.id);
  console.log(error ? `  AVISO: nao removeu ${email}: ${error.message}` : "  usuario de teste removido");
}
console.log(fails ? `\n${fails} FALHA(S)` : "\nConsultas da fase 8 OK.");
process.exitCode = fails ? 1 : 0;
