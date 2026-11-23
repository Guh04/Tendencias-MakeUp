"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@tendencias/core/format";

interface Row {
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

const NAMES: Record<string, string> = {
  entradas: "Entradas",
  saidas: "Saídas",
  saldo: "Saldo acumulado",
};

export function CashFlowChart({ data }: { data: Row[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1e2d8" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a6a6e" }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={{ fontSize: 11, fill: "#7a6a6e" }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `R$${v}`} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #f1e2d8", fontSize: 12 }}
            formatter={(v, name) => [formatBRL(Number(v)), NAMES[String(name)] ?? String(name)]}
          />
          <Legend formatter={(v) => NAMES[String(v)] ?? String(v)} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="entradas" fill="#cd7283" radius={[4, 4, 0, 0]} />
          <Bar dataKey="saidas" fill="#e3cc9a" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="saldo" stroke="#672f3c" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
