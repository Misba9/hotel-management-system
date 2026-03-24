"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { KpiCard } from "@shared/components/kpi-card";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";
const OrdersChart = dynamic(() => import("@/shared/components/orders-chart").then((mod) => mod.OrdersChart), {
  ssr: false
});

type AnalyticsPayload = {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const res = await adminApiFetch("/api/analytics");
        if (!res.ok) {
          setError("Failed to load analytics.");
          setLoading(false);
          return;
        }
        const payload = (await res.json()) as AnalyticsPayload;
        setData(payload);
      } catch {
        setError("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Revenue Analytics</h2>
      <RequestState error={error} loading={loading} loadingMessage="Loading analytics..." />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Daily Revenue" value={loading ? "..." : `Rs. ${data?.dailyRevenue ?? 0}`} />
        <KpiCard label="Weekly Revenue" value={loading ? "..." : `Rs. ${data?.weeklyRevenue ?? 0}`} />
        <KpiCard label="Monthly Revenue" value={loading ? "..." : `Rs. ${data?.monthlyRevenue ?? 0}`} />
      </div>
      <OrdersChart ordersPerDay={data?.ordersPerDay ?? []} revenuePerDay={data?.revenuePerDay ?? []} />
    </section>
  );
}
