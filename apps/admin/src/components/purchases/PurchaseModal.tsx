"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatBRL, parseNumber } from "@tendencias/core/format";
import { actions, useAppState } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select, SearchInput } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Line {
  productId: string;
  qty: string;
  cost: string;
}

const money = (n: number) => n.toFixed(2).replace(".", ",");

export function PurchaseModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Entrada de mercadoria" size="lg">
      {open && <Body onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function Body({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { products, suppliers } = useAppState();
  const toast = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [expense, setExpense] = useState(true);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const found = useMemo(() => {
    const t = norm(search.trim());
    if (!t) return [];
    const taken = new Set(lines.map((l) => l.productId));
    return products
      .filter((p) => !taken.has(p.id) && (norm(p.name).includes(t) || norm(p.sku).includes(t) || p.barcode.includes(search.trim())))
      .slice(0, 6);
  }, [products, search, lines]);

  function add(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setLines((l) => [...l, { productId, qty: "1", cost: money(p.costPrice) }]);
    setSearch("");
    setError("");
  }

  const parsed = lines.map((l) => ({ ...l, q: Number(l.qty), c: parseNumber(l.cost) }));
  const lineOk = (x: (typeof parsed)[number]) => Number.isInteger(x.q) && x.q > 0 && Number.isFinite(x.c) && x.c >= 0;
  const total = parsed.reduce((s, x) => s + (lineOk(x) ? x.q * x.c : 0), 0);

  async function submit() {
    if (lines.length === 0) return setError("Adicione ao menos um produto.");
    if (!parsed.every(lineOk)) return setError("Confira as quantidades (inteiros maiores que zero) e os custos.");
    setBusy(true);
    const res = await actions.receiveGoods({
      supplierId: supplierId || null,
      note: note.trim(),
      registerExpense: expense,
      items: parsed.map((x) => ({ productId: x.productId, qty: x.q, unitCost: x.c })),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return toast.error(res.error);
    }
    toast.success(`Entrada nº ${res.data} registrada: ${lines.length} produto(s), ${formatBRL(total)}.`);
    onDone();
    onClose();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fornecedor (opcional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observação / nº da nota">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: NF 1234" />
        </Field>
      </div>

      <div className="relative">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto por nome, SKU ou código de barras" />
        {found.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-nude-200 bg-white shadow-soft">
            {found.map((p) => (
              <li key={p.id}>
                <button onClick={() => add(p.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-nude-50">
                  <span className="font-medium text-ink-900">{p.name}</span>
                  <span className="text-xs text-ink-500">
                    {p.sku} · estoque {p.stock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-nude-300 p-6 text-center text-sm text-ink-500">
          Busque os produtos que chegaram e informe a quantidade e o custo unitário de cada um.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-nude-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="w-24 px-2 py-2 font-medium">Qtd</th>
                <th className="w-32 px-2 py-2 font-medium">Custo un. (R$)</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-nude-100">
              {lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId);
                const x = parsed[i];
                const changed = p && Number.isFinite(x.c) && Math.round(x.c * 100) !== Math.round(p.costPrice * 100);
                return (
                  <tr key={l.productId}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-900">{p?.name}</p>
                      <p className="text-xs text-ink-500">
                        Estoque {p?.stock} → {(p?.stock ?? 0) + (Number.isInteger(x.q) && x.q > 0 ? x.q : 0)}
                        {changed && <span className="ml-2 text-gold-600">custo muda de {formatBRL(p.costPrice)}</span>}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="numeric"
                        value={l.qty}
                        onChange={(e) => setLines((ls) => ls.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))}
                        aria-label={`Quantidade de ${p?.name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        value={l.cost}
                        onChange={(e) => setLines((ls) => ls.map((y, j) => (j === i ? { ...y, cost: e.target.value } : y)))}
                        aria-label={`Custo de ${p?.name}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-medium">{lineOk(x) ? formatBRL(x.q * x.c) : "—"}</td>
                    <td className="px-1 py-2">
                      <IconButton aria-label={`Remover ${p?.name}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="hover:text-red-600">
                        <Trash2 className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={expense} onChange={(e) => setExpense(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
        <span>
          Lançar o total como despesa no Financeiro
          <span className="block text-xs text-ink-500">Desmarque se já registrou esse pagamento ou se ainda não vai pagar.</span>
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-nude-100 pt-3">
        <p className="text-sm text-ink-500">
          Total da compra: <strong className="font-display text-xl text-ink-900">{formatBRL(total)}</strong>
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || lines.length === 0}>
            {busy ? "Registrando..." : "Registrar entrada"}
          </Button>
        </div>
      </div>
    </div>
  );
}
