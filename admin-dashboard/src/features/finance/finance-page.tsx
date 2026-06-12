"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Download, Receipt, TrendingUp, Wallet } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

const SalesChart = dynamic(
  () => import("@/components/charts/premium-charts").then((m) => m.SalesChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function FinancePageFeature() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-analytics"],
    queryFn: async () => {
      const res = await adminApiFetch("/api/analytics");
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as AdminAnalyticsPayload;
    }
  });

  const revenue = data?.revenueToday ?? 0;
  const expense = revenue * 0.62;
  const profit = revenue - expense;
  const cogs = revenue * 0.38;
  const tax = revenue * 0.05;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const transactions = [
    { id: "TXN-8821", type: "Sale", amount: 1240, method: "UPI", time: "2m ago" },
    { id: "TXN-8820", type: "Expense", amount: -4500, method: "Vendor", time: "1h ago" },
    { id: "TXN-8819", type: "Sale", amount: 890, method: "Cash", time: "2h ago" }
  ];

  return (
    <PageShell
      badge="Finance"
      title="Financial Overview"
      description="Revenue · expenses · profit · cash flow"
      action={
        <Button variant="secondary" size="sm">
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Revenue" value={revenue} formatAsCurrency icon={TrendingUp} accent="emerald" loading={isLoading} />
        <MetricCard title="Expense" value={expense} formatAsCurrency icon={ArrowDownRight} accent="rose" loading={isLoading} />
        <MetricCard title="Profit" value={profit} formatAsCurrency icon={ArrowUpRight} accent="orange" loading={isLoading} />
        <MetricCard title="Tax" value={tax} formatAsCurrency icon={Receipt} accent="violet" loading={isLoading} />
        <MetricCard title="COGS" value={cogs} formatAsCurrency icon={Wallet} accent="amber" loading={isLoading} />
        <MetricCard title="Net Margin" value={`${margin}%`} icon={TrendingUp} accent="sky" loading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard hover>
          <h3 className="mb-4 font-semibold text-white">Income vs Expense</h3>
          {data?.revenuePerDay ? <SalesChart revenuePerDay={data.revenuePerDay} /> : <ChartSkeleton />}
        </GlassCard>
        <GlassCard hover>
          <h3 className="mb-4 font-semibold text-white">Cash Flow</h3>
          {data?.revenuePerDay ? (
            <SalesChart revenuePerDay={data.revenuePerDay.map((d) => ({ ...d, revenue: d.revenue * 0.78 }))} />
          ) : (
            <ChartSkeleton />
          )}
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard hover>
          <h3 className="mb-4 font-semibold text-white">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{t.id}</p>
                  <p className="text-xs text-white/40">
                    {t.type} · {t.method} · {t.time}
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard hover>
          <h3 className="mb-4 font-semibold text-white">Recent Expenses</h3>
          <div className="space-y-2">
            {[
              { label: "Vegetable vendor", amount: 4500, date: "Today" },
              { label: "Gas refill", amount: 1200, date: "Yesterday" },
              { label: "Packaging supplies", amount: 890, date: "Jun 10" }
            ].map((e) => (
              <div key={e.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3">
                <div>
                  <p className="text-sm text-white">{e.label}</p>
                  <p className="text-xs text-white/40">{e.date}</p>
                </div>
                <span className="font-semibold text-rose-400">{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </PageShell>
  );
}
