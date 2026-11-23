"use client";

import { useMemo } from "react";
import { AlertTriangle, Banknote, Boxes, ShoppingBag, Ticket, Users } from "lucide-react";
import { useAppState } from "@/lib/store";
import {
  averageTicket,
  dailySeries,
  isLowStock,
  revenue,
  salesInRange,
  topProducts,
} from "@tendencias/core/metrics";
import { dayKey, formatBRL } from "@tendencias/core/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { ChannelCard } from "@/components/dashboard/ChannelCard";
import {
  RecentSalesCard,
  StockAlertsCard,
  TopProductsCard,
} from "@/components/dashboard/DashboardLists";

export default function DashboardPage() {
  const state = useAppState();

  const data = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const todaySales = state.sales.filter((s) => dayKey(s.date) === today);
    const last30 = salesInRange(state.sales, {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29),
      to: now,
    });
    return {
      todayRevenue: revenue(todaySales),
      todayCount: todaySales.length,
      ticket: averageTicket(last30),
      series: dailySeries(state.sales, 7, now),
      top: topProducts(last30, 5),
      last30,
      low: state.products
        .filter(isLowStock)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
      lowCount: state.products.filter(isLowStock).length,
      recent: [...state.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    };
  }, [state.sales, state.products]);

  const weekTotal = data.series.reduce((s, d) => s + d.total, 0);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`Olá, ${state.settings.storeName}`}
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Faturamento do dia" value={formatBRL(data.todayRevenue)} icon={Banknote} />
        <StatCard
          label="Vendas hoje"
          value={String(data.todayCount)}
          hint="Vendas realizadas hoje"
          icon={ShoppingBag}
          tone="gold"
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(data.ticket)}
          hint="Últimos 30 dias"
          icon={Ticket}
          tone="green"
        />
        <StatCard
          label="Produtos cadastrados"
          value={String(state.products.length)}
          icon={Boxes}
          tone="neutral"
        />
        <StatCard
          label="Estoque baixo"
          value={String(data.lowCount)}
          hint={data.lowCount ? "Requer reposição" : "Tudo em dia"}
          icon={AlertTriangle}
          tone={data.lowCount ? "red" : "green"}
        />
        <StatCard label="Total de clientes" value={String(state.clients.length)} icon={Users} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Vendas dos últimos 7 dias"
            subtitle={`Total no período: ${formatBRL(weekTotal)}`}
          />
          <div className="p-4">
            <SalesChart data={data.series} />
          </div>
        </Card>
        <TopProductsCard items={data.top} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChannelCard sales={data.last30} subtitle="Últimos 30 dias · PDV, painel administrativo e e-commerce" />
        <RecentSalesCard sales={data.recent} clients={state.clients} />
        <StockAlertsCard products={data.low} />
      </div>
    </div>
  );
}
