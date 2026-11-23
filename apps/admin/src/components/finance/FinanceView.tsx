"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  Landmark,
  PackageOpen,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatBRL, formatDate, formatPercent } from "@tendencias/core/format";
import { cashFlowSeries, financeSummary, movements } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useConfirm, useToast } from "@/hooks/useFeedback";
import { usePeriod } from "@/hooks/usePeriod";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { CashFlowChart } from "./CashFlowChart";
import { TransactionForm } from "./TransactionForm";

export function FinanceView() {
  const state = useAppState();
  const confirm = useConfirm();
  const toast = useToast();
  const period = usePeriod("30d");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const summary = useMemo(() => financeSummary(state, period.range), [state, period.range]);
  const series = useMemo(() => cashFlowSeries(state, period.range), [state, period.range]);
  const moves = useMemo(
    () => movements(state, period.range).filter((m) => !typeFilter || m.type === typeFilter),
    [state, period.range, typeFilter],
  );

  async function remove(id: string, description: string) {
    const yes = await confirm({
      title: "Excluir movimentação",
      message: `Excluir o lançamento "${description}"?`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!yes) return;
    actions.deleteTransaction(id);
    toast.success("Movimentação excluída.");
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Financeiro"
        subtitle="Faturamento, custos e lucro — cada um calculado separadamente"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Nova movimentação
          </Button>
        }
      />

      <div className="mb-5">
        <PeriodFilter period={period} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento" value={formatBRL(summary.faturamento)} hint={`${summary.vendas} venda(s)`} icon={Coins} />
        <StatCard label="Custo dos produtos" value={formatBRL(summary.custo)} hint="Custo das mercadorias vendidas" icon={PackageOpen} tone="gold" />
        <StatCard
          label="Lucro bruto estimado"
          value={formatBRL(summary.lucroBruto)}
          hint={`Margem bruta ${formatPercent(summary.margemBruta)}`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard label="Despesas" value={formatBRL(summary.despesas)} hint="Operacionais, sem compra de estoque" icon={Receipt} tone="red" />
        <StatCard
          label="Resultado do período"
          value={formatBRL(summary.resultado)}
          hint="Lucro bruto − despesas"
          icon={Wallet}
          tone={summary.resultado >= 0 ? "green" : "red"}
        />
        <StatCard label="Entradas" value={formatBRL(summary.entradas)} icon={ArrowUpCircle} tone="green" />
        <StatCard
          label="Saídas"
          value={formatBRL(summary.saidas)}
          hint={`Inclui ${formatBRL(summary.comprasEstoque)} em compras de estoque`}
          icon={ArrowDownCircle}
          tone="red"
        />
        <StatCard label="Saldo do fluxo de caixa" value={formatBRL(summary.saldo)} hint="Entradas − saídas" icon={Landmark} tone={summary.saldo >= 0 ? "rose" : "red"} />
      </div>

      <p className="mt-3 text-xs text-ink-500">
        Faturamento é tudo que entrou em vendas; lucro bruto desconta o custo dos produtos vendidos;
        o resultado desconta também as despesas. Compras de estoque afetam o caixa, mas não são
        contadas como despesa para não duplicar o custo dos produtos.
      </p>

      <Card className="mt-6">
        <CardHeader title="Fluxo de caixa" subtitle="Entradas, saídas e saldo acumulado no período" />
        <div className="p-4">
          {summary.entradas === 0 && summary.saidas === 0 ? (
            <EmptyState icon={Landmark} title="Sem movimentações no período" description="Registre vendas ou lançamentos para ver o fluxo de caixa." />
          ) : (
            <CashFlowChart data={series} />
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Histórico de movimentações"
          action={
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 w-40" aria-label="Filtrar por tipo">
              <option value="">Todas</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </Select>
          }
        />
        {moves.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma movimentação" description="Não há lançamentos para os filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Descrição</th>
                  <th className="px-3 py-3 font-medium">Categoria</th>
                  <th className="px-3 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {moves.map((m) => (
                  <tr key={`${m.origin}-${m.id}`} className="hover:bg-nude-50">
                    <td className="px-5 py-3 text-ink-700">{formatDate(m.date)}</td>
                    <td className="px-3 py-3 font-medium text-ink-900">{m.description}</td>
                    <td className="px-3 py-3">
                      <Badge tone={m.origin === "venda" ? "rose" : "neutral"}>{m.category}</Badge>
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${m.type === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                      {m.type === "entrada" ? "+" : "−"} {formatBRL(m.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {m.origin === "manual" && (
                        <IconButton aria-label={`Excluir ${m.description}`} onClick={() => remove(m.id, m.description)} className="hover:text-red-600">
                          <Trash2 className="size-4" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
