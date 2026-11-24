"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { formatBRL, formatDateTime } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import { PAGE, rangeBounds } from "@/lib/remote";
import { useAppState } from "@/lib/store";
import { usePeriod } from "@/hooks/usePeriod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { TableSkeleton } from "@tendencias/ui/skeleton";

interface Row {
  id: number;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTIONS: Record<string, string> = {
  produto_criado: "Produto cadastrado",
  produto_alterado: "Produto alterado",
  estoque_entrada: "Entrada de estoque",
  estoque_saida: "Saída de estoque",
  estoque_ajuste: "Ajuste de estoque",
  caixa_aberto: "Caixa aberto",
  caixa_fechado: "Caixa fechado",
  caixa_suprimento: "Suprimento de caixa",
  caixa_sangria: "Sangria de caixa",
  caixa_movimentacao_estornada: "Movimentação de caixa estornada",
  venda_paga: "Venda concluída",
  venda_cancelada: "Venda cancelada",
  devolucao_registrada: "Devolução registrada",
  usuario_criado: "Usuário criado",
  senha_redefinida: "Senha redefinida",
};

const KEYS: Record<string, string> = {
  nome: "Produto",
  numero: "Nº",
  motivo: "Motivo",
  forma: "Forma",
  canal: "Canal",
  email: "E-mail",
  perfil: "Perfil",
  variacao: "Variação",
  estoque_apos: "Estoque após",
  estoque_inicial: "Estoque inicial",
  barcode: "Código de barras",
  origem: "Origem",
  caixa: "Caixa",
  venda: "Venda",
  tipo_original: "Tipo original",
  venda_acima_do_estoque: "Acima do estoque",
};

function detail(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => {
      if (k.endsWith("_cents") && typeof v === "number")
        return `${KEYS[k.replace("_cents", "")] ?? k.replace("_cents", "").replaceAll("_", " ")}: ${formatBRL(v / 100)}`;
      if (typeof v === "boolean") return v ? (KEYS[k] ?? k) : null;
      return `${KEYS[k] ?? k.replaceAll("_", " ")}: ${String(v)}`;
    })
    .filter(Boolean)
    .join(" · ");
}

export function LogsView() {
  const { operators } = useAppState();
  const period = usePeriod("7d");
  const [action, setAction] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const { from, to } = rangeBounds(period.range);
    let q = createClient().from("audit_logs").select("id, user_id, action, entity, entity_id, details, created_at");
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    if (action) q = q.eq("action", action);
    void q
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Não foi possível carregar os registros.");
        else {
          setError("");
          setRows(data as unknown as Row[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period.range, action, limit]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Registro de atividades" subtitle="Quem fez o quê: operações importantes ficam gravadas e não podem ser apagadas" />
      <div className="mb-5">
        <PeriodFilter period={period} />
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        <div className="border-b border-nude-100 p-4">
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-full sm:w-72" aria-label="Tipo de atividade">
            <option value="">Todas as atividades</option>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {!rows ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nenhuma atividade" description="Não há registros para os filtros selecionados." />
        ) : (
          <ul className="divide-y divide-nude-100">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink-900">{ACTIONS[r.action] ?? r.action}</p>
                  <p className="text-xs text-ink-500">
                    {formatDateTime(r.created_at)} · {operators.find((o) => o.id === r.user_id)?.name ?? "Sistema"}
                  </p>
                </div>
                {detail(r.details) && <p className="mt-0.5 text-xs text-ink-500">{detail(r.details)}</p>}
              </li>
            ))}
          </ul>
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
