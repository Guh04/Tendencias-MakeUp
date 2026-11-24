"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Search } from "lucide-react";
import type { PosProduct } from "@/lib/types";
import { brl } from "@/lib/money";
import { EmptyState } from "@tendencias/ui/empty-state";
import { Input } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type LookupFilter = "todos" | "baixo";

/** Consulta de produtos, precos e estoque (sem custo: o operador nao ve valores de custo). */
export function PriceLookupModal({
  open,
  products,
  initialFilter,
  onClose,
}: {
  open: boolean;
  products: PosProduct[];
  initialFilter: LookupFilter;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Consultar produtos e preços" size="lg">
      {open && <Body products={products} initialFilter={initialFilter} />}
    </Modal>
  );
}

function Body({ products, initialFilter }: { products: PosProduct[]; initialFilter: LookupFilter }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LookupFilter>(initialFilter);

  const rows = useMemo(() => {
    const t = norm(q.trim());
    return products
      .filter((p) => (filter === "baixo" ? p.stock <= 3 : true))
      .filter((p) => !t || norm(p.name).includes(t) || norm(p.sku).includes(t) || p.barcode.includes(q.trim()))
      .sort((a, b) => (filter === "baixo" ? a.stock - b.stock : 0))
      .slice(0, 80);
  }, [products, q, filter]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, SKU ou código de barras"
          className="pl-9"
          autoFocus
          autoComplete="off"
          aria-label="Buscar produto"
        />
      </div>
      <div className="flex gap-2 text-xs">
        {(["todos", "baixo"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 ${filter === f ? "border-brand-500 bg-brand-50 text-brand-700" : "border-nude-300 text-ink-500 hover:bg-nude-100"}`}
          >
            {f === "todos" ? "Todos" : "Estoque baixo / zerado"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum produto encontrado" description="Confira o código ou o nome." />
      ) : (
        <ul className="max-h-[26rem] divide-y divide-nude-100 overflow-y-auto rounded-xl border border-nude-200">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-nude-100 text-ink-400">
                  <ImageIcon className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{p.name}</p>
                <p className="truncate text-xs text-ink-500">
                  {p.category} · SKU {p.sku}
                  {p.barcode && ` · ${p.barcode}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-semibold text-brand-700">{brl(p.priceCents)}</p>
                <p className={`text-xs ${p.stock === 0 ? "font-semibold text-red-600" : p.stock <= 3 ? "text-gold-600" : "text-ink-500"}`}>
                  {p.stock === 0 ? "Sem estoque" : `${p.stock} un.`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
