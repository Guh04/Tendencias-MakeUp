import type { DateRange } from "@tendencias/core/types";
import { endOfDay, startOfDay } from "@tendencias/core/format";

/** Limites ISO de um periodo (nulos = sem limite) para filtrar no servidor. */
export function rangeBounds(range: DateRange): { from: string | null; to: string | null } {
  return {
    from: range.from ? startOfDay(range.from).toISOString() : null,
    to: range.to ? endOfDay(range.to).toISOString() : null,
  };
}

export const PAGE = 200;
