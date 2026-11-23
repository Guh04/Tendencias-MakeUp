"use client";

import { CheckCircle2 } from "lucide-react";
import type { Sale, SaleStatus } from "@tendencias/core/types";
import { PAYMENT_LABELS, formatBRL, formatDateTime } from "@tendencias/core/format";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

export const STATUS_LABEL: Record<SaleStatus, string> = {
  pendente: "Pendente",
  paga: "Paga",
  cancelada: "Cancelada",
  devolvida_parcial: "Devolução parcial",
  devolvida: "Devolvida",
};
export const STATUS_TONE: Record<SaleStatus, "gold" | "green" | "red" | "rose" | "neutral"> = {
  pendente: "gold",
  paga: "green",
  cancelada: "red",
  devolvida_parcial: "rose",
  devolvida: "neutral",
};

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
  const { clients, operators } = useAppState();
  const client = sale && clients.find((c) => c.id === sale.clientId);
  const operator = sale && operators.find((o) => o.id === sale.operatorId);

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
              <dt className="text-xs text-ink-500">Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[sale.status]}>{STATUS_LABEL[sale.status]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Cliente</dt>
              <dd className="font-medium">{client?.name ?? "Não identificado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Operador · canal</dt>
              <dd className="font-medium">
                {operator?.name ?? "—"} · {sale.channel === "presencial" ? "Presencial" : "E-commerce"}
              </dd>
            </div>
          </dl>

          {sale.cancelReason && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <strong>Motivo do cancelamento:</strong> {sale.cancelReason}
            </p>
          )}

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
                <tr key={`${i.productId}-${i.unitPrice}`}>
                  <td className="py-2 pr-2">
                    {i.name}
                    {i.returnedQty > 0 && <span className="ml-1 text-xs text-brand-600">({i.returnedQty} devolvido)</span>}
                  </td>
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
            {sale.refunded > 0 && (
              <div className="flex justify-between text-brand-600">
                <span>Devolvido ao cliente</span>
                <span>− {formatBRL(sale.refunded)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-lg font-semibold text-brand-700">
              <span>Total</span>
              <span>{formatBRL(sale.total)}</span>
            </div>
          </div>

          {sale.payments.length > 0 && (
            <div className="rounded-xl bg-nude-100 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-ink-500 uppercase">Pagamento</p>
              {sale.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{PAYMENT_LABELS[p.method]}</span>
                  <span className="font-medium">
                    {formatBRL(p.amount)}
                    {p.change > 0 && <span className="ml-2 text-xs text-ink-500">(recebido {formatBRL(p.received)} · troco {formatBRL(p.change)})</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
