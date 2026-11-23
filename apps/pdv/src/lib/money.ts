import { formatBRL, parseNumber } from "@tendencias/core/format";

/** Formata centavos como moeda. */
export const brl = (cents: number) => formatBRL(cents / 100);

/** Converte texto digitado ("12,50") em centavos. NaN se invalido. */
export function parseCents(text: string): number {
  const n = parseNumber(text);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Centavos como texto editavel ("12,50"). */
export const centsToText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Mensagens do banco sao em portugues; esconde detalhes tecnicos das demais. */
export function friendly(message: string): string {
  if (/Failed to fetch|NetworkError|network/i.test(message)) return "Sem conexão com o servidor. Verifique a internet.";
  if (/row-level security|permission denied/i.test(message)) return "Você não tem permissão para esta operação.";
  return message;
}
