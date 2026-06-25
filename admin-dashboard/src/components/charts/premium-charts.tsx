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
import { useChartTheme } from "@/components/providers/theme-provider";

type SalesChartProps = {
  revenuePerDay: Array<{ day: string; revenue: number }>;
  ordersPerDay?: Array<{ day: string; orders: number }>;
};

const tooltipStyle = (chart: ReturnType<typeof useChartTheme>) => ({
  borderRadius: 12,
  border: `1px solid ${chart.tooltip.border}`,
  background: chart.tooltip.bg,
  color: chart.text,
  backdropFilter: "blur(12px)"
});

function formatDayLabel(day: string) {
  if (day.length >= 10) return day.slice(5);
  return day;
}

function SalesChartComponent({ revenuePerDay, ordersPerDay }: SalesChartProps) {
  const chart = useChartTheme();
  const data = revenuePerDay.map((d, i) => ({
    label: formatDayLabel(d.day),
    day: d.day,
    revenue: d.revenue,
    orders: ordersPerDay?.[i]?.orders ?? 0
  }));

  return (
    <div className="theme-chart h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.colors[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chart.colors[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle(chart)}
            formatter={(v: number, name: string) => [
              name === "revenue" ? `Rs. ${v.toLocaleString("en-IN")}` : v,
              name === "revenue" ? "Revenue" : "Orders"
            ]}
            labelFormatter={(_, p) => {
              const row = p?.[0]?.payload as { day?: string } | undefined;
              return row?.day ?? "";
            }}
          />
          <Area type="monotone" dataKey="revenue" stroke={chart.colors[0]} strokeWidth={2.5} fill="url(#revenueGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopProductsBarComponent({ items }: { items: Array<{ name: string; sold: number }> }) {
  const chart = useChartTheme();
  const data = items.slice(0, 6).map((p) => ({ name: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name, sold: p.sold }));

  return (
    <div className="theme-chart h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke={chart.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11, fill: chart.axis }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle(chart)} />
          <Bar dataKey="sold" fill={chart.colors[0]} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const SalesChart = memo(SalesChartComponent);
export const TopProductsBar = memo(TopProductsBarComponent);
