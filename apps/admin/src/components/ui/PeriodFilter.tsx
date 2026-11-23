"use client";

import { PERIOD_LABELS, type PeriodPreset, type PeriodState } from "@/hooks/usePeriod";
import { Input } from "./Form";

export function PeriodFilter({ period }: { period: PeriodState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-nude-200 bg-white p-1">
        {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => period.setPreset(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              period.preset === p
                ? "bg-brand-600 text-white"
                : "text-ink-500 hover:bg-nude-100"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={period.customFrom}
            max={period.today}
            onChange={(e) => period.setCustomFrom(e.target.value)}
            className="h-9 w-40"
            invalid={period.invalidCustom}
          />
          <span className="text-xs text-ink-400">até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={period.customTo}
            max={period.today}
            onChange={(e) => period.setCustomTo(e.target.value)}
            className="h-9 w-40"
            invalid={period.invalidCustom}
          />
          {period.invalidCustom && (
            <span className="text-xs text-red-600">Data inicial maior que a final.</span>
          )}
        </div>
      )}
    </div>
  );
}
