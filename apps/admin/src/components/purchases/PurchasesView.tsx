"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, PackagePlus, Plus } from "lucide-react";
import { formatBRL, formatDateTime } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import { PAGE } from "@/lib/remote";
import { useAppState } from "@/lib/store";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurchaseModal } from "./PurchaseModal";

interface Row {
  id: string;
  number: number;
  supplier_id: string | null;
  note: string;
  total_cents: number;
  expense_registered: boolean;
  created_by: string | null;
  created_at: string;
  purchase_items: { id: string; name: string; qty: number; unit_cost_cents: number; prev_cost_cents: number }[];
}

export function PurchasesView() {
  const { suppliers, operators } = useAppState();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("purchases")
      .select("id, number, supplier_id, note, total_cents, expense_registered, created_by, created_at, purchase_items(id, name, qty, unit_cost_cents, prev_cost_cents)")
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Não foi possível carregar as entradas.");
        else {
          setError("");
          setRows(data as unknown as Row[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [limit, tick]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Entrada de mercadoria"
        subtitle="Compras de fornecedores: atualizam estoque e custo dos produtos de uma vez"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nova entrada
          </Button>
        }
      />
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        {!rows ? (
          <p className="p-6 text-sm text-ink-500">Carregando...</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title="Nenhuma entrada registrada"
            description="Quando chegar mercadoria, registre aqui para atualizar o estoque e o custo."
            action={<Button onClick={() => setOpen(true)}>Nova entrada</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="w-10" />
                  <th className="px-3 py-3 font-medium">Nº</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Fornecedor</th>
                  <th className="px-3 py-3 text-right font-medium">Itens</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Financeiro</th>
                  <th className="px-5 py-3 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {rows.map((r) => {
                  const isOpen = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="cursor-pointer hover:bg-nude-50" onClick={() => setExpanded(isOpen ? null : r.id)}>
                        <td className="pl-4 text-ink-400">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                        <td className="px-3 py-2.5 font-medium text-ink-900">#{String(r.number).padStart(4, "0")}</td>
                        <td className="px-3 py-2.5 text-ink-700">{formatDateTime(r.created_at)}</td>
                        <td className="px-3 py-2.5 text-ink-700">
                          {suppliers.find((s) => s.id === r.supplier_id)?.name ?? "—"}
                          {r.note && <span className="block text-xs text-ink-500">{r.note}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">{r.purchase_items.length}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatBRL(r.total_cents / 100)}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={r.expense_registered ? "green" : "neutral"}>{r.expense_registered ? "Despesa lançada" : "Não lançada"}</Badge>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-ink-500">{operators.find((o) => o.id === r.created_by)?.name ?? "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-nude-50">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-ink-500">
                                  <th className="py-1 font-medium">Produto</th>
                                  <th className="py-1 text-right font-medium">Qtd</th>
                                  <th className="py-1 text-right font-medium">Custo un.</th>
                                  <th className="py-1 text-right font-medium">Custo anterior</th>
                                  <th className="py-1 text-right font-medium">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.purchase_items.map((i) => (
                                  <tr key={i.id} className="border-t border-nude-200">
                                    <td className="py-1.5 text-ink-900">{i.name}</td>
                                    <td className="py-1.5 text-right">{i.qty}</td>
                                    <td className="py-1.5 text-right">{formatBRL(i.unit_cost_cents / 100)}</td>
                                    <td className="py-1.5 text-right text-ink-500">{formatBRL(i.prev_cost_cents / 100)}</td>
                                    <td className="py-1.5 text-right font-medium">{formatBRL((i.qty * i.unit_cost_cents) / 100)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows && rows.length >= limit && (
          <div className="border-t border-nude-100 p-3 text-center">
            <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
              Carregar mais
            </Button>
          </div>
        )}
      </Card>

      <PurchaseModal open={open} onClose={() => setOpen(false)} onDone={() => setTick((t) => t + 1)} />
    </div>
  );
}
