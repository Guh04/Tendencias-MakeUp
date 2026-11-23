"use client";

import { useMemo, useState } from "react";
import { Ban, Eye, Receipt, Undo2 } from "lucide-react";
import type { Sale } from "@tendencias/core/types";
import { PAYMENT_LABELS, PAYMENT_METHODS, formatBRL, formatDateTime, paymentSummary } from "@tendencias/core/format";
import { inRange, revenue, saleUnits } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { usePeriod } from "@/hooks/usePeriod";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select, SearchInput, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { ReturnModal } from "./ReturnModal";
import { SaleDetail, STATUS_LABEL, STATUS_TONE } from "./SaleDetail";

const CANCELLABLE = new Set(["pendente", "paga", "devolvida_parcial"]);
const RETURNABLE = new Set(["paga", "devolvida_parcial"]);
const COUNTED = new Set(["paga", "devolvida_parcial", "devolvida"]);

export function SalesHistory() {
  const state = useAppState();
  const period = usePeriod("30d");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [cancelling, setCancelling] = useState<Sale | null>(null);
  const [returning, setReturning] = useState<Sale | null>(null);

  const clientName = (id: string | null) => state.clients.find((c) => c.id === id)?.name ?? "Não identificado";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.allSales
      .filter(
        (s) =>
          inRange(s.date, period.range) &&
          (!payment || s.payments.some((p) => p.method === payment)) &&
          (!q ||
            String(s.number).includes(q) ||
            (state.clients.find((c) => c.id === s.clientId)?.name ?? "").toLowerCase().includes(q) ||
            s.items.some((i) => i.name.toLowerCase().includes(q))),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.allSales, state.clients, period.range, payment, search]);

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
            {filtered.length} venda(s) · faturamento líquido{" "}
            <strong className="text-brand-700">{formatBRL(revenue(filtered.filter((s) => COUNTED.has(s.status))))}</strong>
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma venda encontrada" description="Não há vendas para os filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Nº</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 text-center font-medium">Itens</th>
                  <th className="px-3 py-3 font-medium">Pagamento</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-nude-50 ${s.status === "cancelada" ? "text-ink-400" : ""}`}>
                    <td className="px-5 py-3 font-medium">#{String(s.number).padStart(4, "0")}</td>
                    <td className="px-3 py-3">{formatDateTime(s.date)}</td>
                    <td className="px-3 py-3">{clientName(s.clientId)}</td>
                    <td className="px-3 py-3 text-center">{saleUnits(s)}</td>
                    <td className="px-3 py-3">
                      <Badge tone="rose">{paymentSummary(s.payments)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${s.status === "cancelada" ? "line-through" : "text-brand-700"}`}>
                      {formatBRL(s.total)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton aria-label="Ver detalhes" title="Ver detalhes" onClick={() => setSelected(s)}>
                          <Eye className="size-4" />
                        </IconButton>
                        {RETURNABLE.has(s.status) && (
                          <IconButton aria-label="Devolver itens" title="Devolver itens" onClick={() => setReturning(s)}>
                            <Undo2 className="size-4" />
                          </IconButton>
                        )}
                        {CANCELLABLE.has(s.status) && (
                          <IconButton aria-label="Cancelar venda" title="Cancelar venda" onClick={() => setCancelling(s)} className="hover:text-red-600">
                            <Ban className="size-4" />
                          </IconButton>
                        )}
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
          selected &&
          CANCELLABLE.has(selected.status) && (
            <Button
              variant="secondary"
              onClick={() => {
                setCancelling(selected);
                setSelected(null);
              }}
            >
              Cancelar venda
            </Button>
          )
        }
      />
      <CancelSaleModal sale={cancelling} onClose={() => setCancelling(null)} />
      <ReturnModal sale={returning} onClose={() => setReturning(null)} />
    </div>
  );
}

function CancelSaleModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  return (
    <Modal open={!!sale} onClose={onClose} title="Cancelar venda" size="sm">
      {sale && <CancelForm key={sale.id} sale={sale} onClose={onClose} />}
    </Modal>
  );
}

function CancelForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (reason.trim().length < 3) return setError("Informe o motivo do cancelamento.");
    setBusy(true);
    const res = await actions.cancelSale(sale.id, reason.trim());
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Venda cancelada. O estoque foi devolvido.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-ink-700">
        Cancelar a venda <strong>#{String(sale.number).padStart(4, "0")}</strong> ({formatBRL(sale.total)})? Os itens voltam ao
        estoque e o valor sai do faturamento. A venda continua registrada no histórico, nunca é apagada.
      </p>
      <Field label="Motivo" required error={error}>
        <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} invalid={!!error} autoFocus />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
        <Button variant="danger" type="submit" disabled={busy}>
          {busy ? "Cancelando..." : "Cancelar venda"}
        </Button>
      </div>
    </form>
  );
}
