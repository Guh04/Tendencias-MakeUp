"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { formatDateTime } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import { PAGE, rangeBounds } from "@/lib/remote";
import { useAppState } from "@/lib/store";
import { usePeriod } from "@/hooks/usePeriod";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { TableSkeleton } from "@tendencias/ui/skeleton";

interface Row {
  id: number;
  type: "entrada" | "saida" | "ajuste" | "venda" | "cancelamento" | "devolucao";
  qty: number;
  stock_after: number;
  origin: "admin" | "pdv" | "ecommerce" | "sistema";
  reason: string | null;
  created_by: string | null;
  created_at: string;
  products: { name: string; sku: string } | null;
}

const TYPE_LABEL: Record<Row["type"], string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  venda: "Venda",
  cancelamento: "Cancelamento",
  devolucao: "Devolução",
};
const ORIGIN_LABEL: Record<Row["origin"], string> = { admin: "Administrativo", pdv: "PDV", ecommerce: "E-commerce", sistema: "Sistema" };

export function StockMovementsView() {
  const { operators } = useAppState();
  const period = usePeriod("30d");
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const { from, to } = rangeBounds(period.range);
    let q = createClient().from("stock_movements").select("id, type, qty, stock_after, origin, reason, created_by, created_at, products(name, sku)");
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    if (type) q = q.eq("type", type);
    if (origin) q = q.eq("origin", origin);
    void q
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Não foi possível carregar as movimentações.");
        else {
          setError("");
          setRows(data as unknown as Row[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period.range, type, origin, limit]);

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => !t || (r.products?.name ?? "").toLowerCase().includes(t) || (r.products?.sku ?? "").toLowerCase().includes(t));
  }, [rows, search]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Movimentações de estoque" subtitle="Toda entrada, saída, venda, cancelamento e devolução, com origem e responsável" />
      <div className="mb-5">
        <PeriodFilter period={period} />
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-nude-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto ou SKU" className="min-w-48 flex-1" />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full sm:w-44" aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full sm:w-44" aria-label="Origem">
            <option value="">Todas as origens</option>
            {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        {!rows ? (
          <TableSkeleton />
        ) : shown.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação" description="Não há movimentações para os filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Produto</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 text-right font-medium">Qtd</th>
                  <th className="px-3 py-3 text-right font-medium">Estoque após</th>
                  <th className="px-3 py-3 font-medium">Origem</th>
                  <th className="px-5 py-3 font-medium">Responsável / motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-nude-50">
                    <td className="px-5 py-2.5 text-ink-700">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-ink-900">{r.products?.name ?? "—"}</p>
                      <p className="text-xs text-ink-500">{r.products?.sku}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={r.qty > 0 ? "green" : "rose"}>{TYPE_LABEL[r.type]}</Badge>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${r.qty > 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {r.qty > 0 ? "+" : ""}
                      {r.qty}
                    </td>
                    <td className="px-3 py-2.5 text-right">{r.stock_after}</td>
                    <td className="px-3 py-2.5 text-ink-700">{ORIGIN_LABEL[r.origin]}</td>
                    <td className="px-5 py-2.5 text-xs text-ink-500">
                      {operators.find((o) => o.id === r.created_by)?.name ?? "—"}
                      {r.reason && ` · ${r.reason}`}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
