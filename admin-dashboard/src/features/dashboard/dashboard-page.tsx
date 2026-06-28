"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { doc, onSnapshot } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChefHat,
  Clock,
  IndianRupee,
  LayoutGrid,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  Users,
  Wallet
} from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";
import { MetricCard } from "@/components/ui/metric-card";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricSkeletonGrid, ChartSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiInsightsPanel } from "@/components/admin/ai-insights-panel";
import { formatCurrency } from "@/lib/utils";

const SalesChart = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.SalesChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const TopProductsBar = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.TopProductsBar),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

type SummaryMetrics = {
  ordersToday: number;
  pendingOrders: number;
  revenueToday: number;
  activeOrders: number;
  customers: number;
};

const kitchenQueue = [
  { id: "#1042", table: "T-7", items: 4, stage: "Preparing", time: "6m" },
  { id: "#1041", table: "T-3", items: 2, stage: "New", time: "1m" },
  { id: "#1040", table: "Delivery", items: 5, stage: "Ready", time: "12m" }
];

const inventoryAlerts = [
  { item: "Chicken Breast", level: "Critical", stock: "2.1 kg", action: "Reorder" },
  { item: "Tomatoes", level: "Low", stock: "8 kg", action: "Monitor" },
  { item: "Cheese Block", level: "Low", stock: "1.5 kg", action: "Reorder" }
];

const recentActivities = [
  { time: "2m ago", event: "Order #1042 sent to kitchen", type: "order" },
  { time: "8m ago", event: "Table 5 merged with Table 6", type: "table" },
  { time: "15m ago", event: "Payment Rs. 1,890 via UPI", type: "payment" },
  { time: "22m ago", event: "New customer registered — Priya S.", type: "customer" }
];

const staffOnline = [
  { name: "Rajesh K.", role: "Waiter", shift: "Evening", status: "Active" },
  { name: "Anita M.", role: "Cashier", shift: "Evening", status: "Active" },
  { name: "Suresh P.", role: "Kitchen", shift: "Evening", status: "Busy" }
];

const branchPerformance = [
  { branch: "Main Branch", revenue: 42800, orders: 86, occupancy: 78 },
  { branch: "Downtown", revenue: 31200, orders: 64, occupancy: 65 },
  { branch: "Mall Outlet", revenue: 18900, orders: 41, occupancy: 52 }
];

export function DashboardPageFeature() {
  const { user, authClaimsResolved } = useAuth();
  const [highVolumeAlert, setHighVolumeAlert] = useState<{
    active: boolean;
    message: string;
    threshold: number;
  } | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await adminApiFetch("/api/dashboard/summary");
      return (await res.json()) as SummaryMetrics;
    },
    enabled: Boolean(user && authClaimsResolved),
    refetchInterval: 45_000
  });

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: async () => {
      const res = await adminApiFetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to load analytics");
      return (await res.json()) as AdminAnalyticsPayload;
    },
    enabled: Boolean(user && authClaimsResolved),
    staleTime: 60_000
  });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    let unsubscribe: (() => void) | undefined;
    try {
      const db = getFirebaseDb();
      unsubscribe = onSnapshot(doc(db, "adminAlerts", "highOrderVolume"), (snapshot) => {
        const payload = snapshot.data() as { active?: boolean; message?: string; threshold?: number } | undefined;
        if (!payload) return;
        setHighVolumeAlert({
          active: Boolean(payload.active),
          message: String(payload.message ?? ""),
          threshold: Number(payload.threshold ?? 0)
        });
      });
    } catch {
      /* optional */
    }
    return () => unsubscribe?.();
  }, []);

  const summary = summaryQuery.data;
  const analytics = analyticsQuery.data;
  const loading = summaryQuery.isLoading;
  const error = summaryQuery.error instanceof Error ? summaryQuery.error.message : null;
  const avgOrderValue =
    summary && summary.ordersToday > 0 ? Math.round(summary.revenueToday / summary.ordersToday) : 0;

  return (
    <section className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">Executive Overview</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-theme-text-primary sm:text-3xl">Operations Command Center</h2>
          <p className="mt-1 text-sm text-theme-text-secondary">Live metrics · refreshes every 45s</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void summaryQuery.refetch();
            void analyticsQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => void summaryQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {highVolumeAlert?.active ? (
        <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">High order volume</p>
            <p className="text-sm text-amber-700 dark:text-amber-200/70">
              {highVolumeAlert.message} (threshold: {highVolumeAlert.threshold})
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <MetricSkeletonGrid count={8} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            title="Today's Revenue"
            value={summary?.revenueToday ?? 0}
            formatAsCurrency
            icon={IndianRupee}
            accent="emerald"
            trend={{ value: 12 }}
            delay={0}
          />
          <MetricCard title="Today's Orders" value={summary?.ordersToday ?? 0} icon={Package} accent="orange" delay={0.05} />
          <MetricCard title="Active Orders" value={summary?.activeOrders ?? 0} icon={TrendingUp} accent="violet" delay={0.1} />
          <MetricCard
            title="Avg Order Value"
            value={avgOrderValue}
            formatAsCurrency
            icon={Wallet}
            accent="sky"
            delay={0.15}
          />
          <MetricCard title="Table Occupancy" value="72%" hint="18 of 25 tables" icon={LayoutGrid} accent="amber" delay={0.2} />
          <MetricCard title="Kitchen Load" value="68%" hint="Moderate pressure" icon={ChefHat} accent="rose" delay={0.25} />
          <MetricCard title="Delivery Orders" value={summary?.pendingOrders ?? 0} icon={Truck} accent="sky" delay={0.3} />
          <MetricCard title="Customer Visits" value={summary?.customers ?? 0} icon={Users} accent="emerald" delay={0.35} />
        </div>
      )}

      <GlassCard hover delay={0.1}>
        <SectionHeader title="Sales Performance" description="Revenue trend over the last 30 days" />
        <div className="mt-4">
          {analytics?.revenuePerDay ? (
            <SalesChart revenuePerDay={analytics.revenuePerDay} ordersPerDay={analytics.ordersPerDay} />
          ) : (
            <ChartSkeleton />
          )}
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard hover delay={0.15}>
          <SectionHeader title="Live Kitchen Queue" description="Orders in preparation pipeline" />
          <div className="mt-4 space-y-2">
            {kitchenQueue.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl border border-theme-border bg-theme-card p-3 transition hover:border-brand-primary/20"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-brand-primary">{order.id}</span>
                  <span className="text-sm text-theme-text-secondary">{order.table}</span>
                  <Badge variant="neutral">{order.items} items</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={order.stage === "Ready" ? "success" : order.stage === "New" ? "default" : "warning"}>
                    {order.stage}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-theme-text-secondary">
                    <Clock className="h-3 w-3" />
                    {order.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard hover delay={0.2}>
          <SectionHeader title="Inventory Alerts" description="Items requiring attention" />
          <div className="mt-4 space-y-2">
            {inventoryAlerts.map((alert) => (
              <div
                key={alert.item}
                className="flex items-center justify-between rounded-xl border border-theme-border bg-theme-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-theme-text-primary">{alert.item}</p>
                  <p className="text-xs text-theme-text-secondary">{alert.stock} remaining</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={alert.level === "Critical" ? "danger" : "warning"}>{alert.level}</Badge>
                  <Button variant="outline" size="sm">
                    {alert.action}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard hover delay={0.25} className="lg:col-span-2">
          <SectionHeader title="Top Selling Items" description="Best performers today" />
          <div className="mt-4">
            {analytics?.topProducts?.length ? (
              <TopProductsBar items={analytics.topProducts} />
            ) : (
              <ChartSkeleton />
            )}
          </div>
        </GlassCard>

        <GlassCard hover delay={0.3}>
          <SectionHeader title="Recent Activity" />
          <div className="mt-4 space-y-3">
            {recentActivities.map((a, i) => (
              <div key={i} className="flex gap-3 border-l-2 border-brand-primary/30 pl-3">
                <div>
                  <p className="text-sm text-theme-text-primary">{a.event}</p>
                  <p className="text-[10px] text-theme-text-disabled">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard hover delay={0.35}>
          <SectionHeader title="Staff Online" description="Currently on shift" />
          <div className="mt-4 space-y-2">
            {staffOnline.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-xl border border-theme-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full accent-gradient text-xs font-bold text-white">
                    {s.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-theme-text-primary">{s.name}</p>
                    <p className="text-xs text-theme-text-secondary">
                      {s.role} · {s.shift}
                    </p>
                  </div>
                </div>
                <Badge variant={s.status === "Active" ? "success" : "warning"}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </GlassCard>

        <AiInsightsPanel />

        <GlassCard hover delay={0.4}>
          <SectionHeader title="Profit Summary" description="Today's financial snapshot" />
          <div className="mt-4 space-y-3">
            {[
              { label: "Gross Revenue", value: summary?.revenueToday ?? 0 },
              { label: "COGS (est.)", value: (summary?.revenueToday ?? 0) * 0.38 },
              { label: "Net Profit (est.)", value: (summary?.revenueToday ?? 0) * 0.22 }
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-theme-hover px-3 py-2.5">
                <span className="text-sm text-theme-text-secondary">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-theme-text-primary">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard hover delay={0.45}>
        <SectionHeader title="Branch Performance" description="Multi-location comparison" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-theme-border text-[11px] uppercase tracking-wider text-theme-text-disabled">
                <th className="pb-3 pr-4 font-semibold">Branch</th>
                <th className="pb-3 pr-4 font-semibold">Revenue</th>
                <th className="pb-3 pr-4 font-semibold">Orders</th>
                <th className="pb-3 font-semibold">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {branchPerformance.map((b) => (
                <tr key={b.branch} className="border-b border-theme-border last:border-0">
                  <td className="py-3 pr-4 font-medium text-theme-text-primary">{b.branch}</td>
                  <td className="py-3 pr-4 tabular-nums text-theme-text-secondary">{formatCurrency(b.revenue)}</td>
                  <td className="py-3 pr-4 tabular-nums text-theme-text-secondary">{b.orders}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 max-w-[80px] overflow-hidden rounded-full bg-theme-hover">
                        <div className="h-full rounded-full accent-gradient" style={{ width: `${b.occupancy}%` }} />
                      </div>
                      <span className="text-xs text-theme-text-secondary">{b.occupancy}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </section>
  );
}
