"use client";

import { CheckCircle2 } from "lucide-react";
import type { Sale } from "@tendencias/core/types";
import { PAYMENT_LABELS, formatBRL, formatDateTime } from "@tendencias/core/format";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function SaleDetail({
  sale,
  onClose,
  justFinished = false,
  footerExtra,
}: {
  sale: Sale | null;
  onClose: () => void;
  justFinished?: boolean;
  footerExtra?: React.ReactNode;
}) {
  const { clients } = useAppState();
  const client = sale && clients.find((c) => c.id === sale.clientId);

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={sale ? `Venda #${String(sale.number).padStart(4, "0")}` : ""}
      size="md"
      footer={
        <>
          {footerExtra}
          <Button onClick={onClose}>Fechar</Button>
        </>
      }
    >
      {sale && (
        <div className="space-y-4">
          {justFinished && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="size-4" /> Venda finalizada e estoque atualizado.
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Data e horário</dt>
              <dd className="font-medium">{formatDateTime(sale.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Pagamento</dt>
              <dd className="font-medium">{PAYMENT_LABELS[sale.payment]}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-500">Cliente</dt>
              <dd className="font-medium">{client?.name ?? "Não identificado"}</dd>
            </div>
          </dl>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nude-100 text-left text-xs text-ink-500 uppercase">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-center font-medium">Qtd</th>
                <th className="py-2 text-right font-medium">Unit.</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nude-100">
              {sale.items.map((i) => (
                <tr key={i.productId}>
                  <td className="py-2 pr-2">{i.name}</td>
                  <td className="py-2 text-center">{i.qty}</td>
                  <td className="py-2 text-right text-ink-500">{formatBRL(i.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">{formatBRL(i.qty * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 border-t border-nude-100 pt-3 text-sm">
            <div className="flex justify-between text-ink-500">
              <span>Subtotal</span>
              <span>{formatBRL(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-500">
              <span>Desconto</span>
              <span>− {formatBRL(sale.discount)}</span>
            </div>
            <div className="flex justify-between font-display text-lg font-semibold text-brand-700">
              <span>Total</span>
              <span>{formatBRL(sale.total)}</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
