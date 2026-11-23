import type { PaymentMethod } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (n: number) => brl.format(Number.isFinite(n) ? n : 0);

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("pt-BR");

export const formatDateTime = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} Ã s ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const formatPercent = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Converte "12,50" / "1.234,56" / "12.5" em nÃºmero. Retorna NaN se invÃ¡lido. */
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
  credito: "CartÃ£o de crÃ©dito",
  debito: "CartÃ£o de dÃ©bito",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[];

export const CATEGORIES = [
  "Bases",
  "Corretivos",
  "PÃ³s",
  "Blushes",
  "Batons",
  "Gloss",
  "MÃ¡scaras de cÃ­lios",
  "Sombras",
  "Delineadores",
  "Skincare",
  "Perfumes",
  "AcessÃ³rios",
];

export const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Energia e Ã¡gua",
  "Internet e telefone",
  "Marketing",
  "SalÃ¡rios",
  "Embalagens",
  "Impostos e taxas",
  "Compra de estoque",
  "Outros",
];

export const INCOME_CATEGORIES = ["Aporte", "Outros"];

/** Categoria de saÃ­da que representa reposiÃ§Ã£o de mercadoria (nÃ£o entra em despesas operacionais). */
export const STOCK_PURCHASE_CATEGORY = "Compra de estoque";
