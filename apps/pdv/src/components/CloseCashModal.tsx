"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CashSession, PosSettings } from "@/lib/types";
import { brl, friendly, parseCents } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Field, Input, Textarea } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";
import { PaperToggle, PrintArea, Row, Rule, Sheet, usePaper, type Paper } from "./PrintArea";

interface Summary {
  number: number;
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
  refunds_total_cents: number;
  pending_sales: number;
  cancelled_count: number;
  cancelled_total_cents: number;
  expected_cash_cents: number;
}

interface Closed {
  summary: Summary;
  countedCents: number;
  differenceCents: number;
  notes: string;
  closedAt: string;
}

export function CloseCashModal({
  open,
  session,
  operator,
  settings,
  onClose,
  onClosed,
}: {
  open: boolean;
  session: CashSession;
  operator: string;
  settings: PosSettings;
  onClose: () => void;
  onClosed: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Fechamento de caixa" size="md">
      {open && <Body session={session} operator={operator} settings={settings} onClose={onClose} onClosed={onClosed} />}
    </Modal>
  );
}

const diffLabel = (c: number) => (c === 0 ? "Caixa conferido" : c > 0 ? `Sobra de ${brl(c)}` : `Falta de ${brl(-c)}`);

function ReportSheet({ s, closed, session, operator, settings, paper }: { s: Summary; closed: Closed; session: CashSession; operator: string; settings: PosSettings; paper: Paper }) {
  const f = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <Sheet paper={paper}>
      <div className="text-center">
        <p className="text-sm font-bold">{settings.storeName}</p>
        <p>FECHAMENTO DE CAIXA nº {s.number}</p>
      </div>
      <Rule />
      <p>Operador: {operator}</p>
      <p>Abertura: {f(session.openedAt)}</p>
      <p>Fechamento: {f(closed.closedAt)}</p>
      <Rule />
      <Row left="Fundo de caixa" right={brl(s.opening_cents)} />
      <Row left={`Vendas (${s.sales_count})`} right={brl(s.sales_total_cents)} bold />
      <Row left="  Dinheiro" right={brl(s.cash_cents)} />
      <Row left="  PIX" right={brl(s.pix_cents)} />
      <Row left="  Débito" right={brl(s.debit_cents)} />
      <Row left="  Crédito" right={brl(s.credit_cents)} />
      <Rule />
      <Row left="Entradas (suprimento)" right={brl(s.supplies_cents)} />
      <Row left="Retiradas (sangria)" right={`- ${brl(s.withdrawals_cents)}`} />
      <Row left="Devoluções em dinheiro" right={`- ${brl(s.cash_refunds_cents)}`} />
      <Rule />
      <Row left="Dinheiro esperado" right={brl(s.expected_cash_cents)} />
      <Row left="Dinheiro contado" right={brl(closed.countedCents)} />
      <Row left={diffLabel(closed.differenceCents)} right={brl(closed.differenceCents)} bold />
      {closed.notes && (
        <>
          <Rule />
          <p>Obs.: {closed.notes}</p>
        </>
      )}
      <Rule />
      <p className="text-center">Cancelamentos: {s.cancelled_count} ({brl(s.cancelled_total_cents)})</p>
    </Sheet>
  );
}

function Body({
  session,
  operator,
  settings,
  onClose,
  onClosed,
}: {
  session: CashSession;
  operator: string;
  settings: PosSettings;
  onClose: () => void;
  onClosed: () => void;
}) {
  const toast = useToast();
  const { paper, setPaper } = usePaper();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<Closed | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("cash_session_summary", { p_session_id: session.id })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setLoadError(friendly(err.message));
        else setSummary(data as Summary);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  const countedCents = parseCents(counted);
  const countedOk = counted.trim() !== "" && Number.isFinite(countedCents) && countedCents >= 0;
  const difference = summary && countedOk ? countedCents - summary.expected_cash_cents : 0;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!summary) return;
    if (!countedOk) return setError("Informe o dinheiro contado na gaveta (pode ser 0,00).");
    if (difference !== 0 && notes.trim().length < 3) return setError("Há diferença no caixa: explique nas observações.");
    setBusy(true);
    const { data, error: err } = await createClient().rpc("close_cash_session", {
      p_session_id: session.id,
      p_counted_cents: countedCents,
      p_notes: notes.trim(),
    });
    setBusy(false);
    if (err) return setError(friendly(err.message));
    const row = data as { closed_at: string; difference_cents: number };
    toast.success("Caixa fechado.");
    setClosed({ summary, countedCents, differenceCents: row.difference_cents, notes: notes.trim(), closedAt: row.closed_at });
  }

  if (loadError) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>;
  if (!summary) return <p className="p-4 text-center text-ink-500">Calculando fechamento...</p>;

  if (closed)
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Caixa fechado. {diffLabel(closed.differenceCents)}.
        </p>
        <PaperToggle paper={paper} onChange={setPaper} />
        <div className="overflow-x-auto rounded-xl border border-nude-200 bg-nude-50 p-3">
          <ReportSheet s={closed.summary} closed={closed} session={session} operator={operator} settings={settings} paper={paper} />
        </div>
        <PrintArea paper={paper}>
          <ReportSheet s={closed.summary} closed={closed} session={session} operator={operator} settings={settings} paper={paper} />
        </PrintArea>
        <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir resumo
          </Button>
          <Button onClick={onClosed}>Concluir</Button>
        </div>
      </div>
    );

  const line = (label: string, value: number, strong = false) => (
    <div className={`flex justify-between ${strong ? "font-semibold text-ink-900" : "text-ink-700"}`}>
      <span>{label}</span>
      <span>{brl(value)}</span>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {summary.pending_sales > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          Existem {summary.pending_sales} venda(s) pendente(s). Conclua ou cancele antes de fechar o caixa.
        </p>
      )}
      <div className="space-y-1 rounded-xl bg-nude-100 p-4 text-sm">
        {line("Fundo de caixa", summary.opening_cents)}
        {line(`Vendas (${summary.sales_count})`, summary.sales_total_cents, true)}
        <div className="ml-3 space-y-0.5 text-xs text-ink-500">
          {line("Dinheiro", summary.cash_cents)}
          {line("PIX", summary.pix_cents)}
          {line("Cartão de débito", summary.debit_cents)}
          {line("Cartão de crédito", summary.credit_cents)}
        </div>
        {line("Entradas (suprimento)", summary.supplies_cents)}
        {line("Retiradas (sangria)", -summary.withdrawals_cents)}
        {line("Devoluções em dinheiro", -summary.cash_refunds_cents)}
        <div className="border-t border-nude-300 pt-2">{line("Dinheiro esperado na gaveta", summary.expected_cash_cents, true)}</div>
      </div>

      <Field label="Dinheiro contado na gaveta (R$)" required error={error}>
        <Input
          inputMode="decimal"
          value={counted}
          onChange={(e) => {
            setCounted(e.target.value);
            setError("");
          }}
          invalid={!!error}
          autoFocus
          placeholder="0,00"
        />
      </Field>
      {countedOk && (
        <p className={`text-sm font-medium ${difference === 0 ? "text-emerald-700" : "text-red-600"}`}>{diffLabel(difference)}</p>
      )}
      <Field label="Observações">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
        <Button type="submit" variant="danger" disabled={busy || summary.pending_sales > 0}>
          {busy ? "Fechando..." : "Fechar caixa"}
        </Button>
      </div>
    </form>
  );
}
