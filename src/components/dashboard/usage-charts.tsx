"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export type UsagePoint = {
  month: string; // etiqueta, ej: "Ago"
  credits: number;
};

export function UsageLineChart({ data }: { data: UsagePoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-credits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f06d04" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f06d04" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(val: any, name: any) => [val as number, name as string]}
            labelFormatter={(label: any) => `Mes: ${label}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="credits"
            name="Créditos"
            stroke="#f06d04"
            strokeWidth={2}
            fill="url(#grad-credits)"
            isAnimationActive
            animationDuration={600}
          />
          <Line type="monotone" dataKey="credits" name="" stroke="#f06d04" strokeWidth={2} dot={{ r: 2 }} isAnimationActive animationDuration={600} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
