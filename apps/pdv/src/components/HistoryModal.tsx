"use client";

import { useEffect, useState } from "react";
import { Ban, ChevronDown, ChevronRight, Printer, Receipt, Undo2 } from "lucide-react";
import type { PaymentMethod, SaleStatus } from "@tendencias/core/types";
import { PAYMENT_LABELS, PAYMENT_METHODS, dayKey, paymentSummary } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/hooks/useAuth";
import type { PosSettings, ReceiptData } from "@/lib/types";
import { brl, friendly } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { EmptyState } from "@tendencias/ui/empty-state";
import { Field, Input, Select, Textarea } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";
import { ReceiptModal } from "./Receipt";

interface SaleRow {
  id: string;
  number: number;
  status: SaleStatus;
  operator_id: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  cancel_reason: string | null;
  sale_items: { id: string; name: string; qty: number; unit_price_cents: number; returned_qty: number }[];
  sale_payments: { method: PaymentMethod; amount_cents: number; received_cents: number; change_cents: number }[];
  returns: { refund_cents: number }[];
}

const STATUS: Record<SaleStatus, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-gold-300/30 text-gold-600" },
  paga: { label: "Paga", cls: "bg-emerald-50 text-emerald-700" },
  cancelada: { label: "Cancelada", cls: "bg-red-50 text-red-600" },
  devolvida_parcial: { label: "Devolução parcial", cls: "bg-brand-50 text-brand-700" },
  devolvida: { label: "Devolvida", cls: "bg-nude-100 text-ink-500" },
};

const SELECT =
  "id, number, status, operator_id, subtotal_cents, discount_cents, total_cents, created_at, paid_at, cancel_reason, " +
  "sale_items(id, name, qty, unit_price_cents, returned_qty), sale_payments(method, amount_cents, received_cents, change_cents), returns(refund_cents)";

type Preset = "hoje" | "7d" | "data";

export function HistoryModal({
  open,
  profile,
  settings,
  onClose,
  onChanged,
}: {
  open: boolean;
  profile: Profile;
  settings: PosSettings;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Histórico de vendas" size="lg">
      {open && <Body profile={profile} settings={settings} onChanged={onChanged} />}
    </Modal>
  );
}

function Body({ profile, settings, onChanged }: { profile: Profile; settings: PosSettings; onChanged: () => void }) {
  const [preset, setPreset] = useState<Preset>("hoje");
  const [date, setDate] = useState(dayKey(new Date()));
  const [numberText, setNumberText] = useState("");
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<SaleRow | null>(null);
  const [returnFor, setReturnFor] = useState<SaleRow | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const isAdmin = profile.role === "admin";
  const canCancel = isAdmin || profile.can_cancel_sales;
  const canRefund = isAdmin || profile.can_refund;

  useEffect(() => {
    let cancelled = false;
    const n = Number(numberText);
    let query = createClient().from("sales").select(SELECT);
    if (numberText.trim() && Number.isInteger(n) && n > 0) {
      query = query.eq("number", n);
    } else {
      const start = new Date();
      if (preset === "7d") start.setDate(start.getDate() - 6);
      let from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      let to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + (preset === "7d" ? 7 : 1));
      if (preset === "data") {
        const [y, m, d] = date.split("-").map(Number);
        from = new Date(y, m - 1, d);
        to = new Date(y, m - 1, d + 1);
      }
      query = query.gte("created_at", from.toISOString()).lt("created_at", to.toISOString());
    }
    void query
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(friendly(err.message));
        else {
          setError("");
          setRows(data as unknown as SaleRow[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preset, date, numberText, tick]);

  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  function toReceipt(s: SaleRow): ReceiptData {
    return {
      number: s.number,
      date: s.paid_at ?? s.created_at,
      operator: s.operator_id === profile.id ? profile.full_name : "—",
      items: s.sale_items.map((i) => ({ name: i.name, qty: i.qty, unitCents: i.unit_price_cents })),
      subtotalCents: s.subtotal_cents,
      discountCents: s.discount_cents,
      totalCents: s.total_cents,
      payments: s.sale_payments.map((p) => ({
        method: p.method,
        amountCents: p.amount_cents,
        receivedCents: p.received_cents,
        changeCents: p.change_cents,
      })),
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-xl border border-nude-200 p-1">
          {(
            [
              ["hoje", "Hoje"],
              ["7d", "7 dias"],
              ["data", "Data"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${preset === k ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-nude-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "data" && (
          <Input type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" aria-label="Data" />
        )}
        <Input
          inputMode="numeric"
          value={numberText}
          onChange={(e) => setNumberText(e.target.value.replace(/\D/g, ""))}
          placeholder="Nº da venda"
          className="h-9 w-36"
          aria-label="Buscar pelo número da venda"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!rows ? (
        <p className="p-6 text-center text-ink-500">Carregando...</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma venda encontrada" description="Não há vendas para este filtro." />
      ) : (
        <ul className="divide-y divide-nude-100 rounded-xl border border-nude-200">
          {rows.map((s) => {
            const opened = openId === s.id;
            const st = STATUS[s.status];
            const cancellable = canCancel && ["pendente", "paga", "devolvida_parcial"].includes(s.status);
            const refundable = canRefund && ["paga", "devolvida_parcial"].includes(s.status);
            return (
              <li key={s.id}>
                <button onClick={() => setOpenId(opened ? null : s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-nude-50">
                  {opened ? <ChevronDown className="size-4 text-ink-400" /> : <ChevronRight className="size-4 text-ink-400" />}
                  <span className="w-14 text-sm font-semibold">#{String(s.number).padStart(4, "0")}</span>
                  <span className="w-14 text-xs text-ink-500">
                    {new Date(s.paid_at ?? s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{paymentSummary(s.sale_payments)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  <span className={`w-24 text-right text-sm font-semibold ${s.status === "cancelada" ? "text-ink-400 line-through" : "text-brand-700"}`}>
                    {brl(s.total_cents)}
                  </span>
                </button>
                {opened && (
                  <div className="space-y-3 bg-nude-50 px-4 py-3 text-sm">
                    <p className="text-xs text-ink-500">{new Date(s.paid_at ?? s.created_at).toLocaleDateString("pt-BR")}</p>
                    <ul className="space-y-1">
                      {s.sale_items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span>
                            {i.qty}× {i.name}
                            {i.returned_qty > 0 && <span className="ml-1 text-xs text-brand-600">({i.returned_qty} devolvido)</span>}
                          </span>
                          <span>{brl(i.qty * i.unit_price_cents)}</span>
                        </li>
                      ))}
                    </ul>
                    {s.discount_cents > 0 && <p className="text-ink-500">Desconto: − {brl(s.discount_cents)}</p>}
                    {s.returns.length > 0 && (
                      <p className="text-brand-700">Devolvido ao cliente: {brl(s.returns.reduce((a, r) => a + r.refund_cents, 0))}</p>
                    )}
                    {s.cancel_reason && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Cancelada: {s.cancel_reason}</p>}
                    <div className="flex flex-wrap gap-2">
                      {s.status !== "pendente" && s.status !== "cancelada" && (
                        <Button size="sm" variant="secondary" onClick={() => setReceipt(toReceipt(s))}>
                          <Printer className="size-3.5" /> Segunda via
                        </Button>
                      )}
                      {refundable && (
                        <Button size="sm" variant="secondary" onClick={() => setReturnFor(s)}>
                          <Undo2 className="size-3.5" /> Devolver itens
                        </Button>
                      )}
                      {cancellable && (
                        <Button size="sm" variant="danger" onClick={() => setCancelFor(s)}>
                          <Ban className="size-3.5" /> Cancelar venda
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!canCancel && !canRefund && (
        <p className="text-xs text-ink-400">Cancelar e devolver exigem permissão. Peça a um administrador.</p>
      )}

      <CancelModal sale={cancelFor} onClose={() => setCancelFor(null)} onDone={refresh} />
      <ReturnModal sale={returnFor} onClose={() => setReturnFor(null)} onDone={refresh} />
      <ReceiptModal data={receipt} settings={settings} title="Segunda via" closeLabel="Fechar" onClose={() => setReceipt(null)} />
    </div>
  );
}

function CancelModal({ sale, onClose, onDone }: { sale: SaleRow | null; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={!!sale} onClose={onClose} title="Cancelar venda" size="sm">
      {sale && <CancelForm key={sale.id} sale={sale} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function CancelForm({ sale, onClose, onDone }: { sale: SaleRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (reason.trim().length < 3) return setError("Informe o motivo do cancelamento.");
    setBusy(true);
    const { error: err } = await createClient().rpc("cancel_sale", { p_sale_id: sale.id, p_reason: reason.trim() });
    setBusy(false);
    if (err) return toast.error(friendly(err.message));
    toast.success("Venda cancelada. O estoque foi devolvido.");
    onClose();
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-ink-700">
        Cancelar a venda <strong>#{String(sale.number).padStart(4, "0")}</strong> ({brl(sale.total_cents)})? Os itens voltam ao estoque. A venda
        continua registrada no histórico.
      </p>
      <Field label="Motivo" required error={error}>
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
        <Button type="submit" variant="danger" disabled={busy}>
          {busy ? "Cancelando..." : "Cancelar venda"}
        </Button>
      </div>
    </form>
  );
}

function ReturnModal({ sale, onClose, onDone }: { sale: SaleRow | null; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={!!sale} onClose={onClose} title="Devolução de itens" size="md">
      {sale && <ReturnForm key={sale.id} sale={sale} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function ReturnForm({ sale, onClose, onDone }: { sale: SaleRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const returnable = sale.sale_items.filter((i) => i.qty - i.returned_qty > 0);
  // estimativa (o valor exato e calculado pelo banco, proporcional ao desconto)
  const estimate = returnable.reduce(
    (s, i) => s + Math.round(((qtys[i.id] ?? 0) * i.unit_price_cents * sale.total_cents) / sale.subtotal_cents),
    0,
  );
  const selected = returnable.filter((i) => (qtys[i.id] ?? 0) > 0);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (selected.length === 0) return setError("Selecione ao menos um item e a quantidade.");
    if (reason.trim().length < 3) return setError("Informe o motivo da devolução.");
    setBusy(true);
    const { error: err } = await createClient().rpc("register_return", {
      p_sale_id: sale.id,
      p_items: selected.map((i) => ({ sale_item_id: i.id, qty: qtys[i.id], restock: restock[i.id] ?? true })),
      p_reason: reason.trim(),
      p_refund_method: method,
    });
    setBusy(false);
    if (err) return setError(friendly(err.message));
    toast.success("Devolução registrada.");
    onClose();
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ul className="divide-y divide-nude-100 rounded-xl border border-nude-200">
        {returnable.map((i) => {
          const max = i.qty - i.returned_qty;
          return (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-ink-500">
                  {brl(i.unit_price_cents)} · pode devolver até {max}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs text-ink-500">
                <input
                  type="checkbox"
                  checked={restock[i.id] ?? true}
                  onChange={(e) => setRestock((r) => ({ ...r, [i.id]: e.target.checked }))}
                  className="accent-brand-600"
                />
                voltar ao estoque
              </label>
              <Select
                value={qtys[i.id] ?? 0}
                onChange={(e) => {
                  setQtys((q) => ({ ...q, [i.id]: Number(e.target.value) }));
                  setError("");
                }}
                className="h-9 w-20"
                aria-label={`Quantidade a devolver de ${i.name}`}
              >
                {Array.from({ length: max + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Devolver o valor em" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-xl bg-brand-50 p-3 text-center">
          <p className="text-xs text-ink-500">Reembolso estimado</p>
          <p className="font-display text-2xl font-semibold text-brand-700">{brl(estimate)}</p>
        </div>
      </div>
      <Field label="Motivo" required error={error}>
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError("");
          }}
          invalid={!!error}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Registrando..." : "Registrar devolução"}
        </Button>
      </div>
    </form>
  );
}
