// Teste de integracao das regras de negocio contra o banco Supabase REAL.
// Cria usuarios/dados "qa-*" de teste. Limpe depois com tests/cleanup.sql.
// Uso: node tests/integration.mjs   (le apps/admin/.env.local; nunca imprime chaves)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../../../apps/admin/.env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL || !PUB || !SECRET) throw new Error("Variaveis do Supabase ausentes em apps/admin/.env.local");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL, SECRET, opts);
const anon = createClient(URL, PUB, opts);

let passed = 0;
const failures = [];
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
}
async function fails(name, promise, re) {
  const { data, error } = await promise;
  const matched = !!error && (!re || re.test(error.message));
  ok(name, matched, error ? `(erro: ${error.message})` : `(sem erro; retornou ${JSON.stringify(data)?.slice(0, 80)})`);
}
async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const stamp = Date.now();
const password = `Qa-${stamp}-Xy!9`;
async function makeUser(tag, role, perms = {}) {
  const email = `qa-${tag}-${stamp}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: `QA ${tag}` },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  if (Object.keys(perms).length)
    await must(service.from("profiles").update(perms).eq("id", data.user.id), "perms");
  const client = createClient(URL, PUB, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`login ${tag}: ${e2.message}`);
  return { client, id: data.user.id, email };
}

const money = (c) => (c / 100).toFixed(2);

async function main() {
  console.log("== Preparacao");
  const admin = await makeUser("admin", "admin");
  const op = await makeUser("operador", "operator");
  const barcode = `789${String(stamp).slice(-10)}`;

  console.log("== Seguranca basica");
  await fails("visitante (anon) nao executa checkout_sale", anon.rpc("checkout_sale", { p_items: [], p_payments: [] }), /permission denied|denied/i);
  const spont = await anon.auth.signUp({ email: `qa-spont-${stamp}@example.com`, password });
  if (spont.error) ok("cadastro espontaneo bloqueado pelo servidor", true);
  else if (spont.data.session) {
    const r = await spont.data.session ? await createClient(URL, PUB, opts).auth.setSession(spont.data.session) : null;
    void r;
    const c = createClient(URL, PUB, opts);
    await c.auth.setSession(spont.data.session);
    const { data } = await c.from("products").select("id");
    ok("cadastro espontaneo nasce sem acesso a produtos", (data ?? []).length === 0);
  } else ok("cadastro espontaneo nao gera sessao", true);

  console.log("== Produtos");
  const p1 = await must(
    admin.client.rpc("create_product", {
      p_name: "QA Batom Teste",
      p_barcode: barcode,
      p_category: "Batons",
      p_cost_cents: 1000,
      p_price_cents: 2500,
      p_stock: 10,
      p_origin: "admin",
    }),
    "create_product",
  );
  ok("produto criado com estoque inicial 10", p1.stock === 10);
  await fails(
    "codigo de barras duplicado e recusado (PDV)",
    op.client.rpc("create_product", { p_name: "Outro", p_barcode: barcode, p_category: "Batons", p_cost_cents: 1, p_price_cents: 100, p_stock: 1 }),
    /código de barras/,
  );
  const auto = await must(
    op.client.rpc("create_product", { p_name: "QA Sem Codigo", p_barcode: "", p_category: "Gloss", p_cost_cents: 500, p_price_cents: 1500, p_stock: 3 }),
    "create_product auto",
  );
  ok("codigo interno EAN-13 gerado automaticamente", /^2\d{12}$/.test(auto.barcode ?? ""), `(${auto.barcode})`);
  const costsSeenByOp = await must(op.client.from("product_costs").select("*"), "costs op");
  ok("operador NAO enxerga custo dos produtos", costsSeenByOp.length === 0);
  const stockMovesOp = await must(op.client.from("stock_movements").select("*"), "moves op");
  ok("operador NAO le movimentacoes de estoque", stockMovesOp.length === 0);
  await fails("estoque nao pode ser editado direto", admin.client.from("products").update({ stock: 999 }).eq("id", p1.id), /só pode ser alterado/);

  console.log("== Caixa e vendas");
  const item = (id, qty) => [{ product_id: id, qty }];
  await fails("sem caixa aberto nao vende", op.client.rpc("checkout_sale", { p_items: item(p1.id, 1), p_payments: [{ method: "pix", amount_cents: 2500 }] }), /Abra o caixa/);
  const cash = await must(op.client.rpc("open_cash_session", { p_opening_cents: 10000, p_notes: "teste" }), "open");
  ok("caixa aberto", cash.status === "aberto");
  await fails("segundo caixa aberto do mesmo operador e recusado", op.client.rpc("open_cash_session", { p_opening_cents: 0 }), /já possui um caixa/);

  const s1 = await must(op.client.rpc("checkout_sale", { p_items: item(p1.id, 2), p_payments: [{ method: "pix", amount_cents: 5000 }] }), "s1");
  ok("venda paga", s1.status === "paga" && s1.total_cents === 5000);
  const afterS1 = await must(admin.client.from("products").select("stock").eq("id", p1.id).single(), "stock");
  ok("estoque 10 - 2 = 8 (visto pelo admin)", afterS1.stock === 8, `(${afterS1.stock})`);

  await fails("venda acima do estoque e recusada", op.client.rpc("checkout_sale", { p_items: item(p1.id, 20), p_payments: [{ method: "pix", amount_cents: 50000 }] }), /Estoque insuficiente/);
  await fails("operador sem autorizacao nao vende acima do estoque", op.client.rpc("checkout_sale", { p_items: item(p1.id, 20), p_payments: [{ method: "pix", amount_cents: 50000 }], p_allow_oversell: true }), /autoriza/);
  await fails("desconto acima do limite do operador", op.client.rpc("checkout_sale", { p_items: item(p1.id, 1), p_payments: [{ method: "pix", amount_cents: 2000 }], p_discount_cents: 500 }), /limite/);
  await fails("pagamento que nao fecha o total e recusado", op.client.rpc("checkout_sale", { p_items: item(p1.id, 1), p_payments: [{ method: "pix", amount_cents: 1000 }] }), /difere do total/);

  const s2 = await must(
    op.client.rpc("checkout_sale", {
      p_items: item(p1.id, 1),
      p_discount_cents: 250,
      p_payments: [
        { method: "pix", amount_cents: 1000 },
        { method: "dinheiro", amount_cents: 1250, received_cents: 2000 },
      ],
    }),
    "s2",
  );
  const pays = await must(op.client.from("sale_payments").select("method,amount_cents,change_cents").eq("sale_id", s2.id), "pays");
  const cashPay = pays.find((p) => p.method === "dinheiro");
  ok("pagamento dividido registrado (2 formas)", pays.length === 2);
  ok("troco calculado: R$ 20,00 recebidos para R$ 12,50 = R$ 7,50", cashPay?.change_cents === 750, `(${cashPay?.change_cents})`);
  ok("total com desconto = R$ 22,50", s2.total_cents === 2250);

  await fails("operador sem permissao nao cancela venda", op.client.rpc("cancel_sale", { p_sale_id: s1.id, p_reason: "teste" }), /permissão/);
  await fails("operador sem permissao nao devolve", op.client.rpc("register_return", { p_sale_id: s1.id, p_items: [], p_reason: "x" }), /permissão/);

  console.log("== Concorrencia (estoque 5, 6 vendas simultaneas de 2 unidades)");
  const p2 = await must(
    admin.client.rpc("create_product", { p_name: "QA Concorrencia", p_barcode: `788${String(stamp).slice(-10)}`, p_category: "Bases", p_cost_cents: 100, p_price_cents: 2500, p_stock: 5, p_origin: "admin" }),
    "p2",
  );
  const attempt = (c, isAdmin) =>
    c.client.rpc("checkout_sale", { p_items: item(p2.id, 2), p_payments: [{ method: "pix", amount_cents: 5000 }], p_require_session: !isAdmin, p_origin: isAdmin ? "admin" : "pdv" });
  const results = await Promise.all([attempt(op, false), attempt(admin, true), attempt(op, false), attempt(admin, true), attempt(op, false), attempt(admin, true)]);
  const okCount = results.filter((r) => !r.error).length;
  const finalP2 = await must(admin.client.from("products").select("stock").eq("id", p2.id).single(), "p2 stock");
  ok("exatamente 2 vendas aprovadas", okCount === 2, `(${okCount})`);
  ok("estoque final = 1 e nunca negativo", finalP2.stock === 1, `(${finalP2.stock})`);
  ok("as recusadas informam estoque insuficiente", results.filter((r) => r.error).every((r) => /Estoque insuficiente/.test(r.error.message)));

  console.log("== Cancelamento, devolucao e imutabilidade");
  await must(admin.client.rpc("cancel_sale", { p_sale_id: s1.id, p_reason: "Cliente desistiu (teste)" }), "cancel");
  const afterCancel = await must(admin.client.from("products").select("stock").eq("id", p1.id).single(), "stock2");
  ok("cancelamento devolve estoque (7 + 2 = 9)", afterCancel.stock === 9, `(${afterCancel.stock})`);
  const cancelled = await must(admin.client.from("sales").select("status,cancel_reason,cancelled_by").eq("id", s1.id).single(), "cancelled");
  ok("venda cancelada guarda motivo e responsavel", cancelled.status === "cancelada" && !!cancelled.cancel_reason && cancelled.cancelled_by === admin.id);
  await fails("cancelar de novo e recusado", admin.client.rpc("cancel_sale", { p_sale_id: s1.id, p_reason: "de novo" }), /já foi cancelada/);
  const del = await admin.client.from("sales").delete().eq("id", s1.id).select();
  const stillThere = await must(service.from("sales").select("id").eq("id", s1.id), "exists");
  ok("admin nao consegue apagar venda (API)", stillThere.length === 1 && (!del.data || del.data.length === 0));
  await fails("nem a chave de servico apaga venda (gatilho)", service.from("sales").delete().eq("id", s1.id), /não pode ser apagado/);

  const s3 = await must(op.client.rpc("checkout_sale", { p_items: item(p1.id, 3), p_payments: [{ method: "pix", amount_cents: 7500 }] }), "s3");
  const items3 = await must(admin.client.from("sale_items").select("id,qty").eq("sale_id", s3.id), "items3");
  const r1 = await must(admin.client.rpc("register_return", { p_sale_id: s3.id, p_items: [{ sale_item_id: items3[0].id, qty: 1, restock: true }], p_reason: "Defeito (teste)", p_refund_method: "pix" }), "ret1");
  const st1 = await must(admin.client.from("sales").select("status").eq("id", s3.id).single(), "st1");
  ok("devolucao parcial: reembolso R$ 25,00 e status parcial", r1.refund_cents === 2500 && st1.status === "devolvida_parcial");
  await fails("devolver mais do que foi vendido e recusado", admin.client.rpc("register_return", { p_sale_id: s3.id, p_items: [{ sale_item_id: items3[0].id, qty: 5 }], p_reason: "abuso", p_refund_method: "pix" }), /inválida/);
  const r2 = await must(admin.client.rpc("register_return", { p_sale_id: s3.id, p_items: [{ sale_item_id: items3[0].id, qty: 2, restock: true }], p_reason: "Restante (teste)", p_refund_method: "pix" }), "ret2");
  const st2 = await must(admin.client.from("sales").select("status").eq("id", s3.id).single(), "st2");
  ok("devolucao total: soma dos reembolsos = total da venda", r1.refund_cents + r2.refund_cents === 7500 && st2.status === "devolvida", `(${r1.refund_cents}+${r2.refund_cents})`);

  console.log("== Fechamento de caixa");
  const pend = await must(op.client.rpc("create_sale", { p_items: item(p1.id, 1) }), "pending");
  ok("venda pendente nao baixa estoque nem conta no caixa", pend.status === "pendente");
  await fails("nao fecha caixa com venda pendente", op.client.rpc("close_cash_session", { p_session_id: cash.id, p_counted_cents: 0 }), /pendente/);
  await must(op.client.rpc("finalize_sale", { p_sale_id: pend.id, p_payments: [{ method: "pix", amount_cents: 2500 }] }), "finalize pend");
  const sum = await must(op.client.rpc("cash_session_summary", { p_session_id: cash.id }), "summary");
  ok(`dinheiro esperado = fundo R$ 100,00 + R$ 12,50 em dinheiro = R$ ${money(11250)}`, sum.expected_cash_cents === 11250, `(${sum.expected_cash_cents})`);
  ok("resumo separa PIX e dinheiro", sum.cash_cents === 1250 && sum.pix_cents > 0);
  const closed = await must(op.client.rpc("close_cash_session", { p_session_id: cash.id, p_counted_cents: 11000, p_notes: "faltou troco" }), "close");
  ok("fechamento registra diferenca (-R$ 2,50)", closed.status === "fechado" && closed.difference_cents === -250, `(${closed.difference_cents})`);
  await fails("nao fecha o mesmo caixa duas vezes", op.client.rpc("close_cash_session", { p_session_id: cash.id, p_counted_cents: 0 }), /já foi fechado/);

  console.log("== Isolamento e auditoria");
  const opSales = await must(op.client.from("sales").select("id,operator_id"), "op sales");
  ok("operador so ve as proprias vendas", opSales.every((s) => s.operator_id === op.id) && opSales.length > 0);
  const opAudit = await must(op.client.from("audit_logs").select("id"), "op audit");
  const adAudit = await must(admin.client.from("audit_logs").select("id"), "ad audit");
  ok("logs: operador nao le, admin le", opAudit.length === 0 && adAudit.length > 5, `(${adAudit.length} registros)`);
  await fails("operador nao altera configuracoes", Promise.resolve(op.client.from("settings").update({ store_name: "hack" }).eq("id", true).select().then((r) => ({ data: r.data, error: r.data?.length ? null : { message: "bloqueado (0 linhas)" } }))), /bloqueado/);

  console.log(`\n${passed} verificacoes OK, ${failures.length} falha(s).`);
  if (failures.length) {
    console.log("Falhas:\n - " + failures.join("\n - "));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("ERRO NO TESTE:", e.message);
  process.exitCode = 1;
});
