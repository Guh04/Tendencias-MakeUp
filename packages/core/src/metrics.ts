import type {
  AppState,
  Client,
  DateRange,
  Movement,
  PaymentMethod,
  Product,
  Sale,
} from "./types";
import {
  STOCK_PURCHASE_CATEGORY,
  dayKey,
  endOfDay,
  round2,
  startOfDay,
} from "./format";

export function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  if (range.from && t < startOfDay(range.from).getTime()) return false;
  if (range.to && t > endOfDay(range.to).getTime()) return false;
  return true;
}

export const salesInRange = (sales: Sale[], range: DateRange) =>
  sales.filter((s) => inRange(s.date, range));

export const saleCost = (s: Sale) => s.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
export const saleUnits = (s: Sale) => s.items.reduce((sum, i) => sum + i.qty, 0);

export const isLowStock = (p: Product) => p.stock <= p.minStock;

export const margin = (p: { costPrice: number; salePrice: number }) =>
  p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0;

export const markup = (p: { costPrice: number; salePrice: number }) =>
  p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;

export function revenue(sales: Sale[]) {
  return round2(sales.reduce((s, x) => s + x.total, 0));
}

export function averageTicket(sales: Sale[]) {
  return sales.length ? revenue(sales) / sales.length : 0;
}

/** SÃ©rie diÃ¡ria (inclui dias sem venda) dos Ãºltimos `days` dias. */
export function dailySeries(sales: Sale[], days: number, now = new Date()) {
  const out: { key: string; label: string; total: number; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({
      key: dayKey(d),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: 0,
      count: 0,
    });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const s of sales) {
    const i = idx.get(dayKey(s.date));
    if (i !== undefined) {
      out[i].total = round2(out[i].total + s.total);
      out[i].count += 1;
    }
  }
  return out;
}

/** SÃ©rie diÃ¡ria cobrindo exatamente um intervalo (limitado a 366 dias). */
export function seriesForRange(sales: Sale[], range: DateRange, now = new Date()) {
  const dates = sales.map((s) => new Date(s.date).getTime());
  const to = range.to ?? now;
  const from = range.from ?? (dates.length ? new Date(Math.min(...dates)) : to);
  const days = Math.min(
    366,
    Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1),
  );
  return dailySeries(sales, days, to);
}

export function topProducts(sales: Sale[], limit = 5) {
  const map = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
  for (const s of sales)
    for (const i of s.items) {
      const cur = map.get(i.productId) ?? { name: i.name, sku: i.sku, qty: 0, revenue: 0 };
      cur.qty += i.qty;
      cur.revenue = round2(cur.revenue + i.qty * i.unitPrice);
      map.set(i.productId, cur);
    }
  return [...map.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

export function paymentBreakdown(sales: Sale[]) {
  const map = new Map<PaymentMethod, { total: number; count: number }>();
  for (const s of sales) {
    const cur = map.get(s.payment) ?? { total: 0, count: 0 };
    cur.total = round2(cur.total + s.total);
    cur.count += 1;
    map.set(s.payment, cur);
  }
  return [...map.entries()].map(([method, v]) => ({ method, ...v }));
}

export function clientStats(client: Client, sales: Sale[]) {
  const mine = sales
    .filter((s) => s.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    sales: mine,
    count: mine.length,
    total: revenue(mine),
    last: mine[0]?.date ?? null,
  };
}

export function topClients(state: AppState, sales: Sale[], limit = 10) {
  return state.clients
    .map((c) => {
      const mine = sales.filter((s) => s.clientId === c.id);
      return { client: c, count: mine.length, total: revenue(mine) };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** HistÃ³rico unificado: vendas (entradas automÃ¡ticas) + lanÃ§amentos manuais. */
export function movements(state: AppState, range: DateRange): Movement[] {
  const fromSales: Movement[] = salesInRange(state.sales, range).map((s) => ({
    id: s.id,
    date: s.date,
    type: "entrada",
    category: "Vendas",
    description: `Venda #${String(s.number).padStart(4, "0")}`,
    amount: s.total,
    origin: "venda",
  }));
  const manual: Movement[] = state.transactions
    .filter((t) => inRange(t.date, range))
    .map((t) => ({ ...t, origin: "manual" as const }));
  return [...fromSales, ...manual].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Faturamento â‰  lucro:
 *  - lucro bruto = faturamento âˆ’ custo dos produtos vendidos
 *  - resultado   = lucro bruto âˆ’ despesas operacionais
 *  - compras de estoque ficam fora das despesas (o custo jÃ¡ Ã© contado no CMV)
 *    mas saem do fluxo de caixa.
 */
export function financeSummary(state: AppState, range: DateRange) {
  const sales = salesInRange(state.sales, range);
  const tx = state.transactions.filter((t) => inRange(t.date, range));
  const faturamento = revenue(sales);
  const custo = round2(sales.reduce((s, x) => s + saleCost(x), 0));
  const lucroBruto = round2(faturamento - custo);
  const sum = (arr: typeof tx) => round2(arr.reduce((s, t) => s + t.amount, 0));
  const despesas = sum(tx.filter((t) => t.type === "saida" && t.category !== STOCK_PURCHASE_CATEGORY));
  const comprasEstoque = sum(tx.filter((t) => t.category === STOCK_PURCHASE_CATEGORY));
  const outrasEntradas = sum(tx.filter((t) => t.type === "entrada"));
  const entradas = round2(faturamento + outrasEntradas);
  const saidas = round2(despesas + comprasEstoque);
  return {
    faturamento,
    custo,
    lucroBruto,
    margemBruta: faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0,
    despesas,
    comprasEstoque,
    resultado: round2(lucroBruto - despesas),
    entradas,
    saidas,
    saldo: round2(entradas - saidas),
    vendas: sales.length,
  };
}

/** Fluxo de caixa diÃ¡rio com saldo acumulado dentro do intervalo. */
export function cashFlowSeries(state: AppState, range: DateRange, now = new Date()) {
  const moves = movements(state, range);
  const dates = moves.map((m) => new Date(m.date).getTime());
  const to = range.to ?? now;
  const from = range.from ?? (dates.length ? new Date(Math.min(...dates)) : to);
  const days = Math.min(
    366,
    Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1),
  );
  const rows: { key: string; label: string; entradas: number; saidas: number; saldo: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to.getFullYear(), to.getMonth(), to.getDate() - i);
    rows.push({
      key: dayKey(d),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      entradas: 0,
      saidas: 0,
      saldo: 0,
    });
  }
  const idx = new Map(rows.map((r, i) => [r.key, i]));
  for (const m of moves) {
    const i = idx.get(dayKey(m.date));
    if (i === undefined) continue;
    if (m.type === "entrada") rows[i].entradas = round2(rows[i].entradas + m.amount);
    else rows[i].saidas = round2(rows[i].saidas + m.amount);
  }
  let acc = 0;
  for (const r of rows) {
    acc = round2(acc + r.entradas - r.saidas);
    r.saldo = acc;
  }
  return rows;
}
