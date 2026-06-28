"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const SalesChart = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.SalesChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const TopProductsBar = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.TopProductsBar),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function ReportsPageFeature() {
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/analytics");
      if (!res.ok) {
        setError("Failed to load reports.");
        return;
      }
      setData((await res.json()) as AdminAnalyticsPayload);
    } catch {
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell
      badge="Reports & Analytics"
      title="Reports Center"
      description="Sales · products · inventory · staff · finance insights"
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="secondary" size="sm">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      }
    >
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Total Orders" value={data?.totalOrders ?? 0} icon={Download} accent="orange" loading={loading} />
        <MetricCard title="Revenue (30d)" value={data?.revenueLast30Days ?? 0} formatAsCurrency icon={Download} accent="emerald" loading={loading} />
        <MetricCard title="Orders Today" value={data?.ordersToday ?? 0} icon={Download} accent="violet" loading={loading} />
        <MetricCard title="Active Orders" value={data?.activeOrders ?? 0} icon={Download} accent="sky" loading={loading} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          {["sales", "products", "inventory", "customers", "staff", "finance"].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sales">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-theme-text-primary">Sales Report</h3>
            {data?.revenuePerDay ? <SalesChart revenuePerDay={data.revenuePerDay} ordersPerDay={data.ordersPerDay} /> : <ChartSkeleton />}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-theme-hover p-3">
                <p className="text-xs text-theme-text-secondary">Revenue today</p>
                <p className="text-lg font-bold text-theme-text-primary">{formatCurrency(data?.revenueToday ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-theme-hover p-3">
                <p className="text-xs text-theme-text-secondary">Delivered (all time)</p>
                <p className="text-lg font-bold text-theme-text-primary">{data?.deliveredOrders ?? 0}</p>
              </div>
              <div className="rounded-xl bg-theme-hover p-3">
                <p className="text-xs text-theme-text-secondary">Chart window</p>
                <p className="text-lg font-bold text-theme-text-primary">{data?.chartDays ?? 30} days</p>
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="products">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-theme-text-primary">Top Products</h3>
            {data?.topProducts?.length ? <TopProductsBar items={data.topProducts} /> : <ChartSkeleton />}
          </GlassCard>
        </TabsContent>

        {["inventory", "customers", "staff", "finance"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <GlassCard>
              <p className="py-12 text-center text-sm capitalize text-theme-text-secondary">
                {tab} reports — schedule automated exports from Settings.
              </p>
              <div className="flex justify-center">
                <Button variant="secondary">Schedule Report</Button>
              </div>
            </GlassCard>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}
