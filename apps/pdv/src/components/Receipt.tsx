"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { PAYMENT_LABELS } from "@tendencias/core/format";
import type { PosSettings, ReceiptData } from "@/lib/types";
import { brl } from "@/lib/money";
import { Button } from "@tendencias/ui/button";
import { Modal } from "@tendencias/ui/modal";

type Paper = "58" | "80";
const PAPER_KEY = "pdv:paper";

function readPaper(): Paper {
  try {
    return localStorage.getItem(PAPER_KEY) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

const line = (left: string, right: string) => (
  <div className="flex justify-between gap-2">
    <span>{left}</span>
    <span className="shrink-0">{right}</span>
  </div>
);

/** Comprovante em fonte monoespacada, dimensionado para bobina de 58 mm ou 80 mm. */
function Paper({ data, settings, paper }: { data: ReceiptData; settings: PosSettings; paper: Paper }) {
  const w = paper === "58" ? 48 : 72; // area imprimivel util (mm)
  const date = new Date(data.date);
  return (
    <div style={{ width: `${w}mm`, fontFamily: "ui-monospace, Consolas, monospace", fontSize: paper === "58" ? 10.5 : 12 }} className="mx-auto bg-white text-black">
      <div className="text-center">
        <p className="text-sm font-bold">{settings.storeName}</p>
        {settings.address && <p>{settings.address}</p>}
        {settings.cnpj && <p>CNPJ: {settings.cnpj}</p>}
        {settings.phone && <p>Tel: {settings.phone}</p>}
      </div>
      <p className="my-1 border-t border-dashed border-black" />
      <p>
        Venda nº {String(data.number).padStart(4, "0")}
      </p>
      <p>
        {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p>Operador: {data.operator}</p>
      <p className="my-1 border-t border-dashed border-black" />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-0.5">
          <p>{i.name}</p>
          {line(`${i.qty} x ${brl(i.unitCents)}`, brl(i.qty * i.unitCents))}
        </div>
      ))}
      <p className="my-1 border-t border-dashed border-black" />
      {line("Subtotal", brl(data.subtotalCents))}
      {data.discountCents > 0 && line("Desconto", `- ${brl(data.discountCents)}`)}
      <div className="flex justify-between gap-2 text-sm font-bold">
        <span>TOTAL</span>
        <span>{brl(data.totalCents)}</span>
      </div>
      <p className="my-1 border-t border-dashed border-black" />
      {data.payments.map((p, idx) => (
        <div key={idx}>
          {line(PAYMENT_LABELS[p.method], brl(p.amountCents))}
          {p.changeCents > 0 && (
            <>
              {line("  Recebido", brl(p.receivedCents))}
              {line("  Troco", brl(p.changeCents))}
            </>
          )}
        </div>
      ))}
      <p className="my-1 border-t border-dashed border-black" />
      <p className="text-center">Obrigada pela preferência!</p>
      <p className="text-center">Documento sem valor fiscal</p>
    </div>
  );
}

export function ReceiptModal({
  data,
  settings,
  onClose,
}: {
  data: ReceiptData | null;
  settings: PosSettings;
  onClose: () => void;
}) {
  const [paper, setPaper] = useState<Paper>(readPaper);

  function choose(p: Paper) {
    setPaper(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      /* sem armazenamento: usa so nesta sessao */
    }
  }

  const width = paper === "58" ? 58 : 80;

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title="Venda concluída"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Nova venda (Esc)
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir comprovante
          </Button>
        </>
      }
    >
      {data && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-ink-500">Papel da impressora</span>
            <div className="flex gap-1 rounded-lg border border-nude-200 p-0.5">
              {(["58", "80"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => choose(p)}
                  aria-pressed={paper === p}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${paper === p ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-nude-100"}`}
                >
                  {p} mm
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-nude-200 bg-nude-50 p-3">
            <Paper data={data} settings={settings} paper={paper} />
          </div>

          {/* Copia usada somente na impressao (fora do modal, direto no body) */}
          {createPortal(
            <div id="receipt-print">
              <style>{`
                #receipt-print { display: none; }
                @media print {
                  @page { size: ${width}mm auto; margin: 0; }
                  body > *:not(#receipt-print) { display: none !important; }
                  #receipt-print { display: block !important; padding: 2mm 0; }
                }
              `}</style>
              <Paper data={data} settings={settings} paper={paper} />
            </div>,
            document.body,
          )}
        </>
      )}
    </Modal>
  );
}
