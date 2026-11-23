"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@tendencias/core/format";

export interface DayPoint {
  label: string;
  total: number;
  count: number;
}

export function SalesChart({ data, height = 260 }: { data: DayPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="roseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b4566a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#b4566a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1e2d8" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#7a6a6e" }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#7a6a6e" }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => `R$${v}`}
          />
          <Tooltip
            cursor={{ stroke: "#d1b06b", strokeDasharray: 4 }}
            contentStyle={{ borderRadius: 12, border: "1px solid #f1e2d8", fontSize: 12 }}
            formatter={(v, name) => [name === "total" ? formatBRL(Number(v)) : v, name === "total" ? "Faturamento" : "Vendas"]}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#b4566a"
            strokeWidth={2.5}
            fill="url(#roseFill)"
            activeDot={{ r: 5, fill: "#b8975a", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
