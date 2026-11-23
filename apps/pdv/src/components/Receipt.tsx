"use client";

import { Printer } from "lucide-react";
import { PAYMENT_LABELS } from "@tendencias/core/format";
import type { PosSettings, ReceiptData } from "@/lib/types";
import { brl } from "@/lib/money";
import { Button } from "@tendencias/ui/button";
import { Modal } from "@tendencias/ui/modal";
import { PaperToggle, PrintArea, Row, Rule, Sheet, usePaper, type Paper } from "./PrintArea";

function ReceiptSheet({ data, settings, paper }: { data: ReceiptData; settings: PosSettings; paper: Paper }) {
  const date = new Date(data.date);
  return (
    <Sheet paper={paper}>
      <div className="text-center">
        <p className="text-sm font-bold">{settings.storeName}</p>
        {settings.address && <p>{settings.address}</p>}
        {settings.cnpj && <p>CNPJ: {settings.cnpj}</p>}
        {settings.phone && <p>Tel: {settings.phone}</p>}
      </div>
      <Rule />
      <p>Venda nº {String(data.number).padStart(4, "0")}</p>
      <p>
        {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p>Operador: {data.operator}</p>
      <Rule />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-0.5">
          <p>{i.name}</p>
          <Row left={`${i.qty} x ${brl(i.unitCents)}`} right={brl(i.qty * i.unitCents)} />
        </div>
      ))}
      <Rule />
      <Row left="Subtotal" right={brl(data.subtotalCents)} />
      {data.discountCents > 0 && <Row left="Desconto" right={`- ${brl(data.discountCents)}`} />}
      <Row left="TOTAL" right={brl(data.totalCents)} bold />
      <Rule />
      {data.payments.map((p, idx) => (
        <div key={idx}>
          <Row left={PAYMENT_LABELS[p.method]} right={brl(p.amountCents)} />
          {p.changeCents > 0 && (
            <>
              <Row left="  Recebido" right={brl(p.receivedCents)} />
              <Row left="  Troco" right={brl(p.changeCents)} />
            </>
          )}
        </div>
      ))}
      <Rule />
      <p className="text-center">Obrigada pela preferência!</p>
      <p className="text-center">Documento sem valor fiscal</p>
    </Sheet>
  );
}

export function ReceiptModal({
  data,
  settings,
  onClose,
  title = "Venda concluída",
  closeLabel = "Nova venda (Esc)",
}: {
  data: ReceiptData | null;
  settings: PosSettings;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
}) {
  const { paper, setPaper } = usePaper();

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {closeLabel}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir comprovante
          </Button>
        </>
      }
    >
      {data && (
        <>
          <PaperToggle paper={paper} onChange={setPaper} />
          <div className="overflow-x-auto rounded-xl border border-nude-200 bg-nude-50 p-3">
            <ReceiptSheet data={data} settings={settings} paper={paper} />
          </div>
          <PrintArea paper={paper}>
            <ReceiptSheet data={data} settings={settings} paper={paper} />
          </PrintArea>
        </>
      )}
    </Modal>
  );
}
