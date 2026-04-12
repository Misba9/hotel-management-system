"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, TrendingUp } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";

const OrdersChart = dynamic(() => import("@/shared/components/orders-chart").then((mod) => mod.OrdersChart), {
  ssr: false
});

export function AnalyticsPageFeature() {
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/analytics");
      if (!res.ok) {
        setError("Failed to load analytics.");
        setData(null);
        return;
      }
      const payload = (await res.json()) as AdminAnalyticsPayload;
      setData(payload);
    } catch {
      setError("Failed to load analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtMoney = (n: number) =>
    `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const chartSubtitle = useMemo(() => {
    if (!data) return "";
    return `Last ${data.chartDays} days (UTC) · revenue window ${data.revenueWindowDays}d`;
  }, [data]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40">
            <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Analytics</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Firestore aggregate counts + bounded window query, reduced in-app for charts.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {data?.windowTruncated ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            High order volume: window hit the read cap — last-30d revenue may be slightly low. Expand limits or add rollups
            later.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total orders (all time)" value={loading ? "…" : String(data?.totalOrders ?? 0)} />
          <StatCard label="Active orders" value={loading ? "…" : String(data?.activeOrders ?? 0)} sub="In pipeline, not final" />
          <StatCard label="Delivered (all time)" value={loading ? "…" : String(data?.deliveredOrders ?? 0)} />
          <StatCard
            label={`Revenue (${data?.revenueWindowDays ?? 30}d)`}
            value={loading ? "…" : fmtMoney(data?.revenueLast30Days ?? 0)}
            sub="From bounded query + reduce()"
          />
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold">Trends</h3>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{chartSubtitle}</span>
          </div>
          <OrdersChart ordersPerDay={data?.ordersPerDay ?? []} revenuePerDay={data?.revenuePerDay ?? []} />
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{sub}</p> : null}
    </div>
  );
}
