import Link from "next/link";
import { AlertTriangle, PackageCheck, Receipt, Trophy } from "lucide-react";
import type { Product, Sale, Client } from "@tendencias/core/types";
import { formatBRL, formatDateTime, paymentSummary } from "@tendencias/core/format";
import { Badge, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function TopProductsCard({
  items,
}: {
  items: { id: string; name: string; qty: number; revenue: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.qty));
  return (
    <Card>
      <CardHeader title="Mais vendidos" subtitle="Últimos 30 dias" />
      {items.length === 0 ? (
        <EmptyState icon={Trophy} title="Sem vendas no período" description="Os produtos mais vendidos aparecerão aqui." />
      ) : (
        <ul className="space-y-4 p-5">
          {items.map((p, i) => (
            <li key={p.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-nude-100 text-xs font-semibold text-gold-600">
                    {i + 1}
                  </span>
                  <span className="truncate text-ink-900">{p.name}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-500">{p.qty} un.</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-nude-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                  style={{ width: `${(p.qty / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RecentSalesCard({ sales, clients }: { sales: Sale[]; clients: Client[] }) {
  return (
    <Card>
      <CardHeader
        title="Últimas vendas"
        action={
          <Link href="/vendas" className="text-xs font-medium text-brand-600 hover:underline">
            Ver todas
          </Link>
        }
      />
      {sales.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma venda ainda" description="Registre a primeira venda no módulo de Vendas." />
      ) : (
        <ul className="divide-y divide-nude-100">
          {sales.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  #{String(s.number).padStart(4, "0")} ·{" "}
                  {clients.find((c) => c.id === s.clientId)?.name ?? "Cliente não identificado"}
                </p>
                <p className="text-xs text-ink-500">
                  {formatDateTime(s.date)} · {paymentSummary(s.payments)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-brand-700">{formatBRL(s.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function StockAlertsCard({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader
        title="Alertas de estoque"
        subtitle="Produtos no estoque mínimo ou abaixo"
        action={
          <Link href="/produtos?filtro=baixo" className="text-xs font-medium text-brand-600 hover:underline">
            Ver produtos
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Estoque saudável" description="Nenhum produto abaixo do mínimo." />
      ) : (
        <ul className="divide-y divide-nude-100">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AlertTriangle
                  className={`size-4 shrink-0 ${p.stock === 0 ? "text-red-500" : "text-gold-500"}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">Mínimo: {p.minStock}</p>
                </div>
              </div>
              <Badge tone={p.stock === 0 ? "red" : "gold"}>
                {p.stock === 0 ? "Esgotado" : `${p.stock} restantes`}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
