"use client";

import { memo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, CartesianGrid } from "recharts";
import { useChartTheme } from "@/components/providers/theme-provider";

type OrdersChartProps = {
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
  /** When false, hides the “orders per day” bar chart (top products shown separately). */
  showOrdersPerDay?: boolean;
};

function formatDayLabel(day: string) {
  if (day.length >= 10) return day.slice(5);
  return day;
}

function OrdersChartComponent({ ordersPerDay, revenuePerDay, showOrdersPerDay = true }: OrdersChartProps) {
  const chart = useChartTheme();
  const ordersData = ordersPerDay.map((d) => ({ ...d, label: formatDayLabel(d.day) }));
  const revenueData = revenuePerDay.map((d) => ({ ...d, label: formatDayLabel(d.day) }));
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${chart.tooltip.border}`,
    background: chart.tooltip.bg,
    color: chart.text
  };

  return (
    <div className={`theme-chart grid gap-4 ${showOrdersPerDay ? "lg:grid-cols-2" : ""}`}>
      {showOrdersPerDay ? (
        <div className="theme-card-elevated h-72 rounded-2xl p-4">
          <h3 className="mb-4 font-semibold text-theme-text-primary">Orders per day</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as { day?: string } | undefined;
                  return row?.day ?? "";
                }}
              />
              <Bar dataKey="orders" fill={chart.colors[0]} radius={[6, 6, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <div className={`theme-card-elevated h-72 rounded-2xl p-4 ${showOrdersPerDay ? "" : "lg:col-span-2"}`}>
        <h3 className="mb-4 font-semibold text-theme-text-primary">Sales over time</h3>
        <p className="mb-2 text-xs text-theme-text-secondary">Daily revenue (UTC) — line chart trend.</p>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.axis }} />
            <YAxis tick={{ fontSize: 11, fill: chart.axis }} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [`Rs. ${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Revenue"]}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload as { day?: string } | undefined;
                return row?.day ?? "";
              }}
            />
            <Line type="monotone" dataKey="revenue" stroke={chart.colors[1]} strokeWidth={3} dot={{ r: 3 }} name="Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const OrdersChart = memo(OrdersChartComponent);
