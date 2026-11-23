import type { PaymentMethod } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (n: number) => brl.format(Number.isFinite(n) ? n : 0);

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("pt-BR");

export const formatDateTime = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const formatPercent = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Converte "12,50" / "1.234,56" / "12.5" em número. Retorna NaN se inválido. */
export function parseNumber(value: string): number {
  const v = value.trim();
  if (!v) return NaN;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Chave local YYYY-MM-DD. */
export function dayKey(d: Date | string): string {
  const date = new Date(d);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${day}`;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[];

export const CATEGORIES = [
  "Bases",
  "Corretivos",
  "Pós",
  "Blushes",
  "Batons",
  "Gloss",
  "Máscaras de cílios",
  "Sombras",
  "Delineadores",
  "Skincare",
  "Perfumes",
  "Acessórios",
];

export const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Energia e água",
  "Internet e telefone",
  "Marketing",
  "Salários",
  "Embalagens",
  "Impostos e taxas",
  "Compra de estoque",
  "Outros",
];

export const INCOME_CATEGORIES = ["Aporte", "Outros"];

/** Categoria de saída que representa reposição de mercadoria (não entra em despesas operacionais). */
export const STOCK_PURCHASE_CATEGORY = "Compra de estoque";

/** Resumo dos pagamentos de uma venda, ex.: "PIX + Dinheiro". */
export const paymentSummary = (payments: { method: PaymentMethod }[]) =>
  payments.length ? [...new Set(payments.map((p) => PAYMENT_LABELS[p.method]))].join(" + ") : "—";
