import { Store } from "lucide-react";
import type { Sale } from "@tendencias/core/types";
import { formatBRL, formatPercent } from "@tendencias/core/format";
import { revenue, revenueByOrigin } from "@tendencias/core/metrics";
import { Card, CardHeader } from "@/components/ui/Card";

/** Faturamento liquido por canal: PDV (loja fisica), painel administrativo e e-commerce. */
export function ChannelCard({ sales, subtitle }: { sales: Sale[]; subtitle: string }) {
  const rows = revenueByOrigin(sales);
  const total = revenue(sales);
  return (
    <Card>
      <CardHeader title="Faturamento por canal" subtitle={subtitle} />
      <div className="space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 text-sm text-ink-500">
            <Store className="size-4 text-gold-600" /> Total da loja
          </span>
          <span className="font-display text-2xl font-semibold text-brand-700">{formatBRL(total)}</span>
        </div>
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0;
            return (
              <li key={r.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-700">
                    {r.label} <span className="text-xs text-ink-400">({r.count} venda{r.count === 1 ? "" : "s"})</span>
                  </span>
                  <span className="font-medium">
                    {formatBRL(r.total)} <span className="text-xs text-ink-400">{formatPercent(pct)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-nude-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        {rows.find((r) => r.key === "ecommerce")?.count === 0 && (
          <p className="text-xs text-ink-400">O canal e-commerce ainda não está ativo; as vendas online aparecerão aqui quando ele for conectado.</p>
        )}
      </div>
    </Card>
  );
}
