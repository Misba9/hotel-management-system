"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { KpiCard } from "@shared/components/kpi-card";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";

const OrdersChart = dynamic(() => import("@/shared/components/orders-chart").then((mod) => mod.OrdersChart), {
  ssr: false
});

const TopProductsChart = dynamic(() => import("@/shared/components/top-products-chart").then((mod) => mod.TopProductsChart), {
  ssr: false
});

export default function AnalyticsPage() {
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
      setData((await res.json()) as AdminAnalyticsPayload);
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

  const weeklyRevenue = useMemo(() => {
    if (!data?.revenuePerDay?.length) return 0;
    const tail = data.revenuePerDay.slice(-7);
    return tail.reduce((s, d) => s + d.revenue, 0);
  }, [data?.revenuePerDay]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayRevenue = useMemo(() => {
    if (typeof data?.revenueToday === "number") return data.revenueToday;
    const row = data?.revenuePerDay?.find((d) => d.day === todayKey);
    return row?.revenue ?? 0;
  }, [data?.revenuePerDay, data?.revenueToday, todayKey]);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Revenue analytics</h2>
      <RequestState error={error} loading={loading} loadingMessage="Loading analytics..." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Orders today (UTC)"
          value={loading ? "..." : String(data?.ordersToday ?? 0)}
        />
        <KpiCard
          label="Today revenue (UTC)"
          value={loading ? "..." : `Rs. ${todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        />
        <KpiCard
          label="Last 7 days revenue"
          value={loading ? "..." : `Rs. ${Math.round(weeklyRevenue * 100) / 100}`}
        />
        <KpiCard
          label={`Window (${data?.revenueWindowDays ?? 30}d) revenue`}
          value={loading ? "..." : `Rs. ${(data?.revenueLast30Days ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        />
      </div>
      <OrdersChart ordersPerDay={data?.ordersPerDay ?? []} revenuePerDay={data?.revenuePerDay ?? []} />
      <TopProductsChart data={data?.topProducts ?? []} />
    </section>
  );
}
