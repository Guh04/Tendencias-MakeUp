"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Lock, LockOpen, Undo2 } from "lucide-react";
import { formatBRL, formatDateTime } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import { PAGE, rangeBounds } from "@/lib/remote";
import { reload, useAppState } from "@/lib/store";
import { usePeriod } from "@/hooks/usePeriod";
import { useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { TableSkeleton } from "@tendencias/ui/skeleton";

interface Movement {
  id: string;
  type: "suprimento" | "sangria" | "devolucao";
  amount_cents: number;
  reason: string;
  created_at: string;
  reverses_id: string | null;
}
interface Summary {
  opening_cents: number;
  sales_count: number;
  sales_total_cents: number;
  cash_cents: number;
  pix_cents: number;
  debit_cents: number;
  credit_cents: number;
  supplies_cents: number;
  withdrawals_cents: number;
  cash_refunds_cents: number;
  cancelled_count: number;
  cancelled_total_cents: number;
  pending_sales: number;
  expected_cash_cents: number;
}
interface Session {
  id: string;
  number: number;
  opened_by: string;
  opened_at: string;
  opening_cents: number;
  opening_notes: string;
  status: "aberto" | "fechado";
  closed_by: string | null;
  closed_at: string | null;
  expected_cash_cents: number | null;
  counted_cash_cents: number | null;
  difference_cents: number | null;
  closing_notes: string | null;
  summary: Summary | null;
  cash_movements: Movement[];
}

const c = (cents: number) => formatBRL(cents / 100);
const TYPE: Record<Movement["type"], string> = { suprimento: "Entrada (suprimento)", sangria: "Retirada (sangria)", devolucao: "Devolução em dinheiro" };

export function CashSessionsView() {
  const { operators } = useAppState();
  const period = usePeriod("30d");
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<Session[] | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reversing, setReversing] = useState<Movement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = rangeBounds(period.range);
    let q = createClient()
      .from("cash_sessions")
      .select("*, cash_movements(id, type, amount_cents, reason, created_at, reverses_id)");
    if (from) q = q.gte("opened_at", from);
    if (to) q = q.lte("opened_at", to);
    void q
      .order("opened_at", { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Não foi possível carregar os caixas.");
        else {
          setError("");
          setRows(data as unknown as Session[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period.range, limit, tick]);

  const name = (id: string | null) => operators.find((o) => o.id === id)?.name ?? "—";

  return (
    <div className="animate-fade-up">
      <PageHeader title="Caixas" subtitle="Abertura, fechamento, diferenças e movimentações de dinheiro de cada caixa" />
      <div className="mb-5">
        <PeriodFilter period={period} />
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        {!rows ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Lock} title="Nenhum caixa no período" description="Os caixas abertos no PDV aparecem aqui." />
        ) : (
          <ul className="divide-y divide-nude-100">
            {rows.map((s) => {
              const opened = openId === s.id;
              const diff = s.difference_cents;
              return (
                <li key={s.id}>
                  <button onClick={() => setOpenId(opened ? null : s.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-nude-50">
                    {opened ? <ChevronDown className="size-4 text-ink-400" /> : <ChevronRight className="size-4 text-ink-400" />}
                    <span className="w-16 font-semibold">Nº {s.number}</span>
                    <span className="min-w-32 flex-1 text-sm text-ink-700">{name(s.opened_by)}</span>
                    <span className="text-xs text-ink-500">
                      {formatDateTime(s.opened_at)}
                      {s.closed_at && ` → ${formatDateTime(s.closed_at)}`}
                    </span>
                    {s.status === "aberto" ? (
                      <Badge tone="green">
                        <LockOpen className="mr-1 size-3" /> Aberto
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <Lock className="mr-1 size-3" /> Fechado
                      </Badge>
                    )}
                    {diff !== null && (
                      <span className={`w-28 text-right text-sm font-semibold ${diff === 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {diff === 0 ? "Sem diferença" : `${diff > 0 ? "Sobra" : "Falta"} ${c(Math.abs(diff))}`}
                      </span>
                    )}
                  </button>
                  {opened && <SessionDetail s={s} name={name} onReverse={setReversing} />}
                </li>
              );
            })}
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

      <ReverseModal
        movement={reversing}
        onClose={() => setReversing(null)}
        onDone={() => {
          setTick((t) => t + 1);
          void reload();
        }}
      />
    </div>
  );
}

function SessionDetail({ s, name, onReverse }: { s: Session; name: (id: string | null) => string; onReverse: (m: Movement) => void }) {
  const [live, setLive] = useState<Summary | null>(null);

  useEffect(() => {
    if (s.status !== "aberto") return;
    let cancelled = false;
    void createClient()
      .rpc("cash_session_summary", { p_session_id: s.id })
      .then(({ data }) => {
        if (!cancelled && data) setLive(data as Summary);
      });
    return () => {
      cancelled = true;
    };
  }, [s.id, s.status, s.cash_movements.length]);

  const sum = s.status === "aberto" ? live : s.summary;
  const reversedIds = new Set(s.cash_movements.map((m) => m.reverses_id).filter(Boolean));
  const moves = [...s.cash_movements].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const row = (label: string, v: number, strong = false) => (
    <div className={`flex justify-between ${strong ? "font-semibold text-ink-900" : "text-ink-700"}`}>
      <span>{label}</span>
      <span>{c(v)}</span>
    </div>
  );

  return (
    <div className="grid gap-4 bg-nude-50 px-5 py-4 text-sm lg:grid-cols-2">
      <div className="space-y-1 rounded-xl bg-white p-4">
        <p className="mb-1 text-xs font-medium tracking-wide text-ink-500 uppercase">Resumo {s.status === "aberto" && "(parcial)"}</p>
        {!sum ? (
          <p className="text-ink-400">Calculando...</p>
        ) : (
          <>
            {row("Fundo de caixa", sum.opening_cents)}
            {row(`Vendas (${sum.sales_count})`, sum.sales_total_cents, true)}
            <div className="ml-3 space-y-0.5 text-xs text-ink-500">
              {row("Dinheiro", sum.cash_cents)}
              {row("PIX", sum.pix_cents)}
              {row("Cartão de débito", sum.debit_cents)}
              {row("Cartão de crédito", sum.credit_cents)}
            </div>
            {row("Suprimentos", sum.supplies_cents)}
            {row("Sangrias", -sum.withdrawals_cents)}
            {row("Devoluções em dinheiro", -sum.cash_refunds_cents)}
            <div className="border-t border-nude-200 pt-1">{row("Dinheiro esperado", sum.expected_cash_cents, true)}</div>
            {s.status === "fechado" && s.counted_cash_cents !== null && row("Dinheiro contado", s.counted_cash_cents, true)}
            {sum.cancelled_count > 0 && (
              <p className="pt-1 text-xs text-ink-500">
                Cancelamentos: {sum.cancelled_count} ({c(sum.cancelled_total_cents)})
              </p>
            )}
          </>
        )}
        {s.opening_notes && <p className="pt-2 text-xs text-ink-500">Abertura: {s.opening_notes}</p>}
        {s.closing_notes && <p className="text-xs text-ink-500">Fechamento: {s.closing_notes}</p>}
        {s.closed_by && <p className="text-xs text-ink-400">Fechado por {name(s.closed_by)}</p>}
      </div>

      <div className="rounded-xl bg-white p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">Movimentações de dinheiro</p>
        {moves.length === 0 ? (
          <p className="text-ink-400">Nenhuma movimentação.</p>
        ) : (
          <ul className="divide-y divide-nude-100">
            {moves.map((m) => {
              const reversed = reversedIds.has(m.id);
              const canReverse = s.status === "aberto" && (m.type === "sangria" || m.type === "suprimento") && !m.reverses_id && !reversed;
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{TYPE[m.type]}</span>
                    {m.reverses_id && <span className="ml-1 text-xs text-brand-600">(estorno)</span>}
                    {reversed && <span className="ml-1 text-xs text-ink-400">(estornado)</span>}
                    <span className="block truncate text-xs text-ink-500">
                      {formatDateTime(m.created_at)} · {m.reason}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={`font-semibold ${m.type === "suprimento" ? "text-emerald-700" : "text-red-600"}`}>
                      {m.type === "suprimento" ? "+" : "−"} {c(m.amount_cents)}
                    </span>
                    {canReverse && (
                      <IconButton aria-label="Estornar movimentação" title="Estornar" onClick={() => onReverse(m)}>
                        <Undo2 className="size-4" />
                      </IconButton>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReverseModal({ movement, onClose, onDone }: { movement: Movement | null; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={!!movement} onClose={onClose} title="Estornar movimentação" size="sm">
      {movement && <ReverseForm key={movement.id} movement={movement} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function ReverseForm({ movement, onClose, onDone }: { movement: Movement; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (reason.trim().length < 3) return setError("Informe o motivo do estorno.");
    setBusy(true);
    const { error: err } = await createClient().rpc("reverse_cash_movement", { p_movement_id: movement.id, p_reason: reason.trim() });
    setBusy(false);
    if (err) return toast.error(err.message);
    toast.success("Movimentação estornada.");
    onClose();
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-ink-700">
        Será lançado o movimento contrário de <strong>{c(movement.amount_cents)}</strong> ({TYPE[movement.type]}: “{movement.reason}”). O lançamento original
        continua registrado.
      </p>
      <Field label="Motivo do estorno" required error={error}>
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError("");
          }}
          invalid={!!error}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Estornando..." : "Estornar"}
        </Button>
      </div>
    </form>
  );
}
