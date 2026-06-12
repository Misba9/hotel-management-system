"use client";

import { memo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type SalesChartProps = {
  revenuePerDay: Array<{ day: string; revenue: number }>;
  ordersPerDay?: Array<{ day: string; orders: number }>;
};

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(18, 18, 26, 0.95)",
  color: "#fff",
  backdropFilter: "blur(12px)"
};

function formatDayLabel(day: string) {
  if (day.length >= 10) return day.slice(5);
  return day;
}

function SalesChartComponent({ revenuePerDay, ordersPerDay }: SalesChartProps) {
  const data = revenuePerDay.map((d, i) => ({
    label: formatDayLabel(d.day),
    day: d.day,
    revenue: d.revenue,
    orders: ordersPerDay?.[i]?.orders ?? 0
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7A00" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FF7A00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => [
              name === "revenue" ? `Rs. ${v.toLocaleString("en-IN")}` : v,
              name === "revenue" ? "Revenue" : "Orders"
            ]}
            labelFormatter={(_, p) => {
              const row = p?.[0]?.payload as { day?: string } | undefined;
              return row?.day ?? "";
            }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#FF7A00" strokeWidth={2.5} fill="url(#revenueGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopProductsBarComponent({ items }: { items: Array<{ name: string; sold: number }> }) {
  const data = items.slice(0, 6).map((p) => ({ name: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name, sold: p.sold }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="sold" fill="#FF7A00" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const SalesChart = memo(SalesChartComponent);
export const TopProductsBar = memo(TopProductsBarComponent);
