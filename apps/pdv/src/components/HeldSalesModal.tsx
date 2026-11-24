"use client";

import { PauseCircle, Play, Trash2 } from "lucide-react";
import type { HeldSale } from "@/lib/held";
import type { PosProduct } from "@/lib/types";
import { brl } from "@/lib/money";
import { Button } from "@tendencias/ui/button";
import { EmptyState } from "@tendencias/ui/empty-state";
import { Modal } from "@tendencias/ui/modal";

export function HeldSalesModal({
  open,
  held,
  products,
  onResume,
  onDiscard,
  onClose,
}: {
  open: boolean;
  held: HeldSale[];
  products: PosProduct[];
  onResume: (h: HeldSale) => void;
  onDiscard: (h: HeldSale) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Vendas em espera" size="md">
      {held.length === 0 ? (
        <EmptyState icon={PauseCircle} title="Nenhuma venda em espera" description="Use F5 na tela de venda para guardar o carrinho e atender outra cliente." />
      ) : (
        <ul className="max-h-96 divide-y divide-nude-100 overflow-y-auto rounded-xl border border-nude-200">
          {held.map((h, i) => {
            const total = h.items.reduce((s, it) => s + it.qty * (products.find((p) => p.id === it.productId)?.priceCents ?? 0), 0);
            const qty = h.items.reduce((s, it) => s + it.qty, 0);
            return (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">
                    Espera {i + 1} · {h.client?.name ?? "sem cliente"}
                  </p>
                  <p className="text-xs text-ink-500">
                    {h.items.length} produto(s), {qty} un. · guardada às{" "}
                    {new Date(h.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-brand-700">{brl(total)}</span>
                <Button size="sm" onClick={() => onResume(h)}>
                  <Play className="size-3.5" /> Retomar
                </Button>
                <button onClick={() => onDiscard(h)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Descartar venda em espera">
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
