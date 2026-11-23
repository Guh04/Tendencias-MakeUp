"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PAYMENT_LABELS, formatBRL } from "@tendencias/core/format";
import type { PaymentMethod } from "@tendencias/core/types";

const PIE_COLORS = ["#b4566a", "#d1b06b", "#e09ba6", "#672f3c"];
const tooltipStyle = { borderRadius: 12, border: "1px solid #f1e2d8", fontSize: 12 };

export function PaymentPie({ data }: { data: { method: PaymentMethod; total: number; count: number }[] }) {
  const rows = data.map((d) => ({ name: PAYMENT_LABELS[d.method], value: d.total }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatBRL(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProductsBar({ data }: { data: { name: string; qty: number }[] }) {
  const rows = data.map((d) => ({ ...d, short: d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name }));
  return (
    <div className="w-full" style={{ height: Math.max(180, rows.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1e2d8" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#7a6a6e" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="short" width={150} tick={{ fontSize: 11, fill: "#4a3a3e" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} un.`, "Vendidas"]} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} />
          <Bar dataKey="qty" fill="#b4566a" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesCountChart({ data }: { data: { label: string; count: number; total: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1e2d8" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a6a6e" }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={{ fontSize: 11, fill: "#7a6a6e" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Vendas"]} />
          <Bar dataKey="count" fill="#d1b06b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
