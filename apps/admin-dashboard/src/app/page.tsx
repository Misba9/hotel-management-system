"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import dynamic from "next/dynamic";
import { KpiCard } from "@shared/components/kpi-card";
import { rtdb } from "@shared/firebase/client";
import { adminApiFetch } from "@/lib/admin-api";
const OrdersChart = dynamic(() => import("@/components/orders-chart").then((mod) => mod.OrdersChart), {
  ssr: false
});

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [highVolumeAlert, setHighVolumeAlert] = useState<{
    active: boolean;
    message: string;
    count: number;
    threshold: number;
  } | null>(null);
  const [data, setData] = useState<{
    totalOrders: number;
    revenue: number;
    totalOrdersToday: number;
    revenueToday: number;
    onlineOrdersToday: number;
    storeOrdersToday: number;
    dailyRevenue: number;
    weeklyRevenue: number;
    monthlyRevenue: number;
    dailySales: number;
    topSellingItems: Array<{ name: string; qty: number }>;
    ordersPerDay: Array<{ day: string; orders: number; revenue: number }>;
    revenuePerDay: Array<{ day: string; revenue: number }>;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const res = await adminApiFetch("/api/dashboard/summary");
      const payload = (await res.json()) as typeof data;
      setData(payload);
      setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    const alertRef = ref(rtdb, "alerts/admin/highOrderVolume");
    const unsubscribe = onValue(alertRef, (snapshot) => {
      const payload = snapshot.val() as {
        active?: boolean;
        message?: string;
        count?: number;
        threshold?: number;
      } | null;
      if (!payload) return;
      setHighVolumeAlert({
        active: Boolean(payload.active),
        message: String(payload.message ?? ""),
        count: Number(payload.count ?? 0),
        threshold: Number(payload.threshold ?? 0)
      });
    });
    return () => unsubscribe();
  }, []);

  const topItem = useMemo(() => data?.topSellingItems?.[0]?.name ?? "-", [data]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Operations Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">Live view of orders, revenue, and sales performance</p>
      </div>

      {highVolumeAlert?.active ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-semibold text-red-700">High Order Volume Alert</p>
          <p className="text-sm text-red-600">
            {highVolumeAlert.message} (threshold: {highVolumeAlert.threshold})
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Orders Today" value={loading ? "..." : String(data?.totalOrdersToday ?? 0)} />
        <KpiCard label="Revenue Today" value={loading ? "..." : `Rs. ${data?.revenueToday ?? 0}`} />
        <KpiCard
          label="Online vs Store Orders"
          value={loading ? "..." : `${data?.onlineOrdersToday ?? 0} / ${data?.storeOrdersToday ?? 0}`}
        />
        <KpiCard label="Top Selling Item" value={loading ? "..." : topItem} />
        <KpiCard label="Total Revenue (7d)" value={loading ? "..." : `Rs. ${data?.revenue ?? 0}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Daily Revenue" value={loading ? "..." : `Rs. ${data?.dailyRevenue ?? 0}`} />
        <KpiCard label="Weekly Revenue" value={loading ? "..." : `Rs. ${data?.weeklyRevenue ?? 0}`} />
        <KpiCard label="Monthly Revenue" value={loading ? "..." : `Rs. ${data?.monthlyRevenue ?? 0}`} />
      </div>

      <OrdersChart ordersPerDay={data?.ordersPerDay ?? []} revenuePerDay={data?.revenuePerDay ?? []} />
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold">Top Selling Juices</h3>
        <div className="space-y-2">
          {(data?.topSellingItems ?? []).map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-slate-600">{item.qty} sold</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
