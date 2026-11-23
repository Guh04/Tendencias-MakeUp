"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Paper = "58" | "80";
const PAPER_KEY = "pdv:paper";

function readPaper(): Paper {
  try {
    return localStorage.getItem(PAPER_KEY) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

/** Largura do papel da impressora termica (58 ou 80 mm), lembrada neste computador. */
export function usePaper() {
  const [paper, setPaperState] = useState<Paper>(readPaper);
  function setPaper(p: Paper) {
    setPaperState(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      /* sem armazenamento: vale so nesta sessao */
    }
  }
  return { paper, setPaper };
}

export function PaperToggle({ paper, onChange }: { paper: Paper; onChange: (p: Paper) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between text-sm">
      <span className="text-ink-500">Papel da impressora</span>
      <div className="flex gap-1 rounded-lg border border-nude-200 p-0.5">
        {(["58", "80"] as const).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-pressed={paper === p}
            className={`rounded-md px-3 py-1 text-xs font-medium ${paper === p ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-nude-100"}`}
          >
            {p} mm
          </button>
        ))}
      </div>
    </div>
  );
}

/** Folha termica: area util de ~48 mm (58 mm) ou ~72 mm (80 mm), fonte monoespacada. */
export function Sheet({ paper, children }: { paper: Paper; children: ReactNode }) {
  return (
    <div
      style={{ width: paper === "58" ? "48mm" : "72mm", fontFamily: "ui-monospace, Consolas, monospace", fontSize: paper === "58" ? 10.5 : 12 }}
      className="mx-auto bg-white text-black"
    >
      {children}
    </div>
  );
}

export const Rule = () => <p className="my-1 border-t border-dashed border-black" />;

export const Row = ({ left, right, bold = false }: { left: string; right: string; bold?: boolean }) => (
  <div className={`flex justify-between gap-2 ${bold ? "text-sm font-bold" : ""}`}>
    <span>{left}</span>
    <span className="shrink-0">{right}</span>
  </div>
);

/** Copia do conteudo montada direto no <body>, exibida somente ao imprimir. */
export function PrintArea({ paper, children }: { paper: Paper; children: ReactNode }) {
  return createPortal(
    <div id="receipt-print">
      <style>{`
        #receipt-print { display: none; }
        @media print {
          @page { size: ${paper}mm auto; margin: 0; }
          body > *:not(#receipt-print) { display: none !important; }
          #receipt-print { display: block !important; padding: 2mm 0; }
        }
      `}</style>
      {children}
    </div>,
    document.body,
  );
}
