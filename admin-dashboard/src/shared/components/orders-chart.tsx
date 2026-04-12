"use client";

import { memo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, CartesianGrid } from "recharts";

type OrdersChartProps = {
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
};

function formatDayLabel(day: string) {
  if (day.length >= 10) return day.slice(5);
  return day;
}

function OrdersChartComponent({ ordersPerDay, revenuePerDay }: OrdersChartProps) {
  const ordersData = ordersPerDay.map((d) => ({ ...d, label: formatDayLabel(d.day) }));
  const revenueData = revenuePerDay.map((d) => ({ ...d, label: formatDayLabel(d.day) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">Orders per day</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={ordersData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-400" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-400" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgb(226 232 240)",
                background: "var(--tooltip-bg, white)"
              }}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload as { day?: string } | undefined;
                return row?.day ?? "";
              }}
            />
            <Bar dataKey="orders" fill="#FF6B35" radius={[6, 6, 0, 0]} name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">Revenue per day</h3>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-400" />
            <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-400" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgb(226 232 240)",
                background: "var(--tooltip-bg, white)"
              }}
              formatter={(v: number) => [`Rs. ${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Revenue"]}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload as { day?: string } | undefined;
                return row?.day ?? "";
              }}
            />
            <Line type="monotone" dataKey="revenue" stroke="#2EC4B6" strokeWidth={3} dot={{ r: 3 }} name="Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const OrdersChart = memo(OrdersChartComponent);
