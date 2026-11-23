"use client";

import { useMemo, useState } from "react";
import { Eye, Receipt, Trash2 } from "lucide-react";
import type { Sale } from "@tendencias/core/types";
import { PAYMENT_LABELS, PAYMENT_METHODS, formatBRL, formatDateTime } from "@tendencias/core/format";
import { saleUnits, revenue } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useConfirm, useToast } from "@/hooks/useFeedback";
import { usePeriod } from "@/hooks/usePeriod";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, SearchInput } from "@/components/ui/Form";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { inRange } from "@tendencias/core/metrics";
import { SaleDetail } from "./SaleDetail";

export function SalesHistory() {
  const state = useAppState();
  const confirm = useConfirm();
  const toast = useToast();
  const period = usePeriod("30d");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const clientName = (id: string | null) =>
    state.clients.find((c) => c.id === id)?.name ?? "Não identificado";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.sales
      .filter(
        (s) =>
          inRange(s.date, period.range) &&
          (!payment || s.payment === payment) &&
          (!q ||
            String(s.number).includes(q) ||
            clientName(s.clientId).toLowerCase().includes(q) ||
            s.items.some((i) => i.name.toLowerCase().includes(q))),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sales, state.clients, period.range, payment, search]);

  async function cancel(s: Sale) {
    const yes = await confirm({
      title: "Cancelar venda",
      message: `Cancelar a venda #${String(s.number).padStart(4, "0")} (${formatBRL(s.total)})? Os itens voltam ao estoque e o valor sai do faturamento.`,
      confirmLabel: "Cancelar venda",
      danger: true,
    });
    if (!yes) return;
    const res = actions.cancelSale(s.id);
    if (res.ok) {
      toast.success("Venda cancelada e estoque restaurado.");
      setSelected(null);
    } else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <PeriodFilter period={period} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-nude-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Nº, cliente ou produto" className="min-w-48 flex-1" />
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full sm:w-52" aria-label="Forma de pagamento">
            <option value="">Todos os pagamentos</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </Select>
          <p className="ml-auto text-sm text-ink-500">
            {filtered.length} venda(s) · <strong className="text-brand-700">{formatBRL(revenue(filtered))}</strong>
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma venda encontrada"
            description="Não há vendas para os filtros selecionados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Nº</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 text-center font-medium">Itens</th>
                  <th className="px-3 py-3 font-medium">Pagamento</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-nude-50">
                    <td className="px-5 py-3 font-medium">#{String(s.number).padStart(4, "0")}</td>
                    <td className="px-3 py-3 text-ink-700">{formatDateTime(s.date)}</td>
                    <td className="px-3 py-3 text-ink-700">{clientName(s.clientId)}</td>
                    <td className="px-3 py-3 text-center">{saleUnits(s)}</td>
                    <td className="px-3 py-3">
                      <Badge tone="rose">{PAYMENT_LABELS[s.payment]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-brand-700">{formatBRL(s.total)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton aria-label="Ver detalhes" title="Ver detalhes" onClick={() => setSelected(s)}>
                          <Eye className="size-4" />
                        </IconButton>
                        <IconButton aria-label="Cancelar venda" title="Cancelar venda" onClick={() => cancel(s)} className="hover:text-red-600">
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SaleDetail
        sale={selected}
        onClose={() => setSelected(null)}
        footerExtra={
          selected && (
            <Button variant="secondary" onClick={() => cancel(selected)}>
              Cancelar venda
            </Button>
          )
        }
      />
    </div>
  );
}
