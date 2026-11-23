"use client";

import { useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, dayKey, parseNumber } from "@tendencias/core/format";
import { actions } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

type Key = "description" | "amount" | "date";

export function TransactionForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nova movimentação" size="sm">
      {open && <Body onClose={onClose} />}
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<"entrada" | "saida">("saida");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [errors, setErrors] = useState<Errors<Key>>({});

  const categories = type === "saida" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function changeType(t: "entrada" | "saida") {
    setType(t);
    setCategory((t === "saida" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0]);
  }

  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Errors<Key> = {};
    const value = parseNumber(amount);
    if (description.trim().length < 3) e.description = "Descreva a movimentação.";
    if (!Number.isFinite(value) || value <= 0) e.amount = "Informe um valor maior que zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = "Data inválida.";
    else if (date > dayKey(new Date())) e.date = "A data não pode ser futura.";
    setErrors(e);
    if (hasErrors(e)) return;

    setBusy(true);
    const res = await actions.addTransaction({
      type,
      category,
      description: description.trim(),
      amount: value,
      date,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Movimentação registrada.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(["saida", "entrada"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            aria-pressed={type === t}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              type === t
                ? t === "saida"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-nude-300 text-ink-500 hover:bg-nude-100"
            }`}
          >
            {t === "saida" ? "Saída (despesa)" : "Entrada"}
          </button>
        ))}
      </div>
      <Field label="Categoria">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Descrição" required error={errors.description}>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} invalid={!!errors.description} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor (R$)" required error={errors.amount}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!errors.amount} placeholder="0,00" />
        </Field>
        <Field label="Data" required error={errors.date}>
          <Input type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          Registrar
        </Button>
      </div>
    </form>
  );
}
