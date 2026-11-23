// Valida, contra o banco real, as MESMAS consultas que o store do ADMIN usa (apps/admin/src/lib/store.ts).
// Cria um administrador "qa-*" e dados de teste; limpe depois com tests/cleanup.sql.
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
const password = `Qa-${stamp}-Zz!7`;
let fails = 0;
const ok = (n, c, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"} ${n} ${c ? "" : x}`); if (!c) fails++; };
const must = async (p, l) => { const { data, error } = await p; if (error) throw new Error(`${l}: ${error.message}`); return data; };
const one = (v) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const email = `qa-adminq-${stamp}@example.com`;
const { data: u, error: ue } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "admin" }, user_metadata: { full_name: "QA Admin Q" } });
if (ue) throw new Error(ue.message);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
await must(db.auth.signInWithPassword({ email, password }).then((r) => ({ data: r.data, error: r.error })), "login");

console.log("== Acoes do store (mesmas chamadas)");
const p = await must(db.rpc("create_product", { p_name: "QA Produto Q", p_barcode: "", p_category: "Batons", p_cost_cents: 1234, p_price_cents: 3990, p_stock: 6, p_description: "", p_image_url: null, p_brand: "QA", p_sku: "", p_min_stock: 2, p_supplier_id: null, p_origin: "admin" }), "create_product");
ok("addProduct via RPC (sem SKU/codigo: gerados)", /^P\d{5}$/.test(p.sku) && /^2\d{12}$/.test(p.barcode), `(${p.sku} ${p.barcode})`);

console.log("== Consultas de carga");
const products = await must(db.from("products").select("*, product_costs(cost_cents)").eq("active", true).order("created_at", { ascending: false }).range(0, 999), "products");
const mine = products.find((x) => x.id === p.id);
ok("produto traz custo embutido (1234 centavos)", one(mine?.product_costs)?.cost_cents === 1234, JSON.stringify(mine?.product_costs));

await must(db.from("products").update({ name: "QA Produto Q2", price_cents: 4500, min_stock: 3 }).eq("id", p.id), "update");
await must(db.from("product_costs").upsert({ product_id: p.id, cost_cents: 2000 }), "upsert custo");
await must(db.rpc("adjust_stock", { p_product_id: p.id, p_delta: 4, p_reason: "teste", p_type: "entrada", p_origin: "admin" }), "adjust");
const after = await must(db.from("products").select("name, price_cents, stock, product_costs(cost_cents)").eq("id", p.id).single(), "after");
ok("updateProduct + custo + estoque (6+4=10)", after.name === "QA Produto Q2" && after.price_cents === 4500 && after.stock === 10 && one(after.product_costs).cost_cents === 2000);

const sale = await must(db.rpc("checkout_sale", { p_items: [{ product_id: p.id, qty: 2 }], p_payments: [{ method: "dinheiro", amount_cents: 9000, received_cents: 10000 }], p_discount_cents: 0, p_client_id: null, p_channel: "presencial", p_require_session: false, p_origin: "admin" }), "checkout (admin sem caixa)");
ok("admin vende sem caixa aberto (tela de vendas do ADMIN)", sale.status === "paga" && sale.total_cents === 9000);

const sales = await must(db.from("sales").select(
  "id, number, channel, status, operator_id, client_id, subtotal_cents, discount_cents, total_cents, created_at, paid_at, cancel_reason, " +
  "sale_items(id, product_id, name, sku, qty, unit_price_cents, returned_qty, sale_item_costs(unit_cost_cents)), " +
  "sale_payments(method, amount_cents, received_cents, change_cents), returns(refund_cents)").order("created_at", { ascending: false }).range(0, 999), "sales");
const s = sales.find((x) => x.id === sale.id);
ok("venda traz itens, custo do item, pagamentos e devolucoes", !!s && s.sale_items.length === 1 && one(s.sale_items[0].sale_item_costs)?.unit_cost_cents === 2000 && s.sale_payments.length === 1 && Array.isArray(s.returns), JSON.stringify(s)?.slice(0, 200));
ok("troco registrado (R$ 10,00)", s?.sale_payments[0].change_cents === 1000);

await must(db.rpc("register_return", { p_sale_id: sale.id, p_items: [{ sale_item_id: s.sale_items[0].id, qty: 1, restock: true }], p_reason: "teste devolucao", p_refund_method: "pix" }), "return");
const s2 = (await must(db.from("sales").select("status, sale_items(returned_qty), returns(refund_cents)").eq("id", sale.id).single(), "s2"));
ok("devolucao parcial aparece em returned_qty e returns", s2.status === "devolvida_parcial" && s2.sale_items[0].returned_qty === 1 && s2.returns[0].refund_cents === 4500);

await must(db.rpc("cancel_sale", { p_sale_id: sale.id, p_reason: "teste cancelamento" }), "cancel");
const s3 = await must(db.from("sales").select("status, cancel_reason").eq("id", sale.id).single(), "s3");
const stock = await must(db.from("products").select("stock").eq("id", p.id).single(), "stock");
ok("cancelamento: status, motivo e estoque (10-2+1+1 = 10)", s3.status === "cancelada" && s3.cancel_reason === "teste cancelamento" && stock.stock === 10, `(${stock.stock})`);

const c = await must(db.from("clients").insert({ name: "QA Cliente", phone: "11999990000", email: "" }).select().single(), "client");
const sp = await must(db.from("suppliers").insert({ name: "QA Fornecedor", contact: "x", phone: "", email: "", notes: "" }).select().single(), "supplier");
await must(db.from("suppliers").update({ active: false }).eq("id", sp.id), "arquiva fornecedor");
const sups = await must(db.from("suppliers").select("*").eq("active", true), "sups");
ok("cliente criado e fornecedor arquivado some da lista", !!c.id && !sups.some((x) => x.id === sp.id));
await must(db.from("transactions").insert({ occurred_on: "2026-11-23", type: "saida", category: "Aluguel", description: "QA aluguel", amount_cents: 150000 }), "tx");
const tx = await must(db.from("transactions").select("*").order("occurred_on", { ascending: false }), "txs");
ok("transacao gravada em centavos", tx.some((t) => t.amount_cents === 150000 && t.occurred_on === "2026-11-23"));
const st = await must(db.from("settings").select("*").maybeSingle(), "settings");
await must(db.from("settings").update({ store_name: "Tendencias MakeUp", max_operator_discount_pct: 10 }).eq("id", true), "upd settings");
ok("configuracoes lidas (linha unica)", st?.store_name === "Tendencias MakeUp");
const prof = await must(db.from("profiles").select("id, full_name"), "profiles");
ok("admin le a lista de perfis", prof.length >= 1);

console.log(fails ? `\n${fails} FALHA(S)` : "\nTodas as consultas e acoes do store funcionam.");
process.exitCode = fails ? 1 : 0;
