"use client";

import { useMemo } from "react";
import { BarChart3, PackageCheck, Trophy, Users } from "lucide-react";
import { PAYMENT_LABELS, formatBRL, formatPercent } from "@tendencias/core/format";
import {
  averageTicket,
  isLowStock,
  margin,
  paymentBreakdown,
  revenue,
  salesInRange,
  seriesForRange,
  topClients,
  topProducts,
} from "@tendencias/core/metrics";
import { useAppState } from "@/lib/store";
import { usePeriod } from "@/hooks/usePeriod";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { PaymentPie, SalesCountChart, TopProductsBar } from "./ReportCharts";

export function ReportsView() {
  const state = useAppState();
  const period = usePeriod("30d");

  const d = useMemo(() => {
    const sales = salesInRange(state.sales, period.range);
    const sold = new Map<string, number>();
    const profit = new Map<string, number>();
    for (const s of sales)
      for (const i of s.items) {
        sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty);
        profit.set(i.productId, (profit.get(i.productId) ?? 0) + i.qty * (i.unitPrice - i.unitCost));
      }
    return {
      sales,
      total: revenue(sales),
      ticket: averageTicket(sales),
      top: topProducts(sales, 8),
      payments: paymentBreakdown(sales),
      series: seriesForRange(sales, period.range),
      clients: topClients(state, sales, 8),
      low: state.products.filter(isLowStock).sort((a, b) => a.stock - b.stock),
      margins: [...state.products]
        .sort((a, b) => margin(b) - margin(a))
        .map((p) => ({ p, sold: sold.get(p.id) ?? 0, profit: profit.get(p.id) ?? 0 })),
    };
  }, [state, period.range]);

  const noSales = d.sales.length === 0;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Relatórios" subtitle="Análises calculadas a partir das vendas reais do sistema" />
      <PeriodFilter period={period} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Faturamento no período" value={formatBRL(d.total)} icon={BarChart3} />
        <StatCard label="Vendas" value={String(d.sales.length)} icon={Trophy} tone="gold" />
        <StatCard label="Ticket médio" value={formatBRL(d.ticket)} icon={Users} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Faturamento por período" subtitle="Valor vendido por dia" />
          <div className="p-4">
            {noSales ? <EmptyState icon={BarChart3} title="Sem vendas no período" /> : <SalesChart data={d.series} height={256} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Evolução das vendas" subtitle="Quantidade de vendas por dia" />
          <div className="p-4">
            {noSales ? <EmptyState icon={BarChart3} title="Sem vendas no período" /> : <SalesCountChart data={d.series} />}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Produtos mais vendidos" subtitle="Por unidades vendidas" />
          <div className="p-4">
            {d.top.length === 0 ? <EmptyState icon={Trophy} title="Sem vendas no período" /> : <TopProductsBar data={d.top} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Vendas por forma de pagamento" />
          <div className="p-4">
            {d.payments.length === 0 ? (
              <EmptyState icon={BarChart3} title="Sem vendas no período" />
            ) : (
              <>
                <PaymentPie data={d.payments} />
                <ul className="mt-2 divide-y divide-nude-100 text-sm">
                  {d.payments.map((p) => (
                    <li key={p.method} className="flex justify-between py-2">
                      <span>
                        {PAYMENT_LABELS[p.method]} <span className="text-ink-400">({p.count})</span>
                      </span>
                      <span className="font-medium">
                        {formatBRL(p.total)}{" "}
                        <span className="text-xs text-ink-400">
                          {formatPercent(d.total ? (p.total / d.total) * 100 : 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Clientes que mais compram" subtitle="Ranking por valor no período" />
        {d.clients.length === 0 ? (
          <EmptyState icon={Users} title="Sem compras identificadas" description="Selecione um cliente ao finalizar as vendas para vê-lo aqui." />
        ) : (
          <ul className="divide-y divide-nude-100">
            {d.clients.map((c, i) => (
              <li key={c.client.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-nude-100 text-xs font-semibold text-gold-600">{i + 1}</span>
                  <span className="font-medium">{c.client.name}</span>
                </span>
                <span className="text-right">
                  <span className="font-semibold text-brand-700">{formatBRL(c.total)}</span>
                  <span className="block text-xs text-ink-500">{c.count} compra(s)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Margem por produto" subtitle="Margem = (venda − custo) ÷ venda · lucro realizado no período selecionado" />
        {d.margins.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Sem produtos cadastrados" />
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-3 py-3 text-right font-medium">Custo</th>
                  <th className="px-3 py-3 text-right font-medium">Venda</th>
                  <th className="px-3 py-3 text-right font-medium">Margem</th>
                  <th className="px-3 py-3 text-right font-medium">Vendidos</th>
                  <th className="px-5 py-3 text-right font-medium">Lucro bruto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {d.margins.map(({ p, sold, profit }) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-right text-ink-500">{formatBRL(p.costPrice)}</td>
                    <td className="px-3 py-2.5 text-right">{formatBRL(p.salePrice)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge tone={margin(p) >= 40 ? "green" : margin(p) >= 20 ? "gold" : "red"}>{formatPercent(margin(p))}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">{sold}</td>
                    <td className="px-5 py-2.5 text-right font-medium">{formatBRL(profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Produtos com baixo estoque" subtitle="Situação atual (independe do período)" />
        {d.low.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Estoque saudável" description="Nenhum produto no mínimo ou abaixo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-3 py-3 font-medium">Categoria</th>
                  <th className="px-3 py-3 text-center font-medium">Estoque</th>
                  <th className="px-5 py-3 text-center font-medium">Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {d.low.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-ink-700">{p.category}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge tone={p.stock === 0 ? "red" : "gold"}>{p.stock === 0 ? "Esgotado" : p.stock}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-center text-ink-500">{p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
