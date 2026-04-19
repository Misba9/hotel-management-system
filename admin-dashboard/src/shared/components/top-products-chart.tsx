"use client";

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TopProductDatum = { name: string; sold: number; revenue: number };

type Props = {
  data: TopProductDatum[];
};

function truncateName(name: string, max = 28) {
  const t = name.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function TopProductsChartComponent({ data }: Props) {
  const chartData = data.map((row) => ({
    ...row,
    label: truncateName(row.name)
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
        No line items in this window yet.
      </div>
    );
  }

  return (
    <div className="h-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">Top products by revenue</h3>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Aggregated from order line items in the same date window as revenue (units sold × price).
      </p>
      <ResponsiveContainer width="100%" height="78%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-600 dark:text-slate-400"
            tickFormatter={(v: number) => `Rs.${Math.round(v)}`}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-slate-600 dark:text-slate-400"
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid rgb(226 232 240)",
              background: "var(--tooltip-bg, white)"
            }}
            formatter={(value: number) => [`Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Revenue"]}
            labelFormatter={(_, p) => {
              const row = p?.[0]?.payload as TopProductDatum | undefined;
              return row?.name ?? "";
            }}
          />
          <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 6, 6, 0]} name="Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const TopProductsChart = memo(TopProductsChartComponent);
