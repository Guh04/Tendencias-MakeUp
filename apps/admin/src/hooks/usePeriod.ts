"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "@tendencias/core/types";
import { dayKey } from "@tendencias/core/format";

export type PeriodPreset = "hoje" | "7d" | "30d" | "mes" | "tudo" | "custom";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
  tudo: "Tudo",
  custom: "Personalizado",
};

function parseKey(k: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function usePeriod(initial: PeriodPreset = "30d") {
  const [preset, setPreset] = useState<PeriodPreset>(initial);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range: DateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
    switch (preset) {
      case "hoje":
        return { from: today, to: today };
      case "7d":
        return { from: back(6), to: today };
      case "30d":
        return { from: back(29), to: today };
      case "mes":
        return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
      case "tudo":
        return { from: null, to: null };
      case "custom":
        return { from: parseKey(customFrom), to: parseKey(customTo) };
    }
  }, [preset, customFrom, customTo]);

  const invalidCustom =
    preset === "custom" && !!range.from && !!range.to && range.from > range.to;

  return {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range: invalidCustom ? { from: null, to: null } : range,
    invalidCustom,
    today: dayKey(new Date()),
  };
}

export type PeriodState = ReturnType<typeof usePeriod>;
