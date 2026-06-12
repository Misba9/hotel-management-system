"use client";

import { ChefHat, CreditCard, LayoutGrid, MonitorDot, Package, Truck, Users, Zap } from "lucide-react";
import { ManagerOrdersPageFeature } from "@/features/operations/manager-orders-page";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";

const liveEvents = [
  { time: "Just now", event: "Order #1042 accepted — Table 7", type: "order" },
  { time: "3m ago", event: "Kitchen marked #1039 as Ready", type: "kitchen" },
  { time: "7m ago", event: "Cash counter closed shift — Rs. 24,800", type: "payment" },
  { time: "12m ago", event: "Delivery partner assigned to #1036", type: "delivery" }
];

export function OperationsCommandCenter() {
  return (
    <PageShell
      badge="Live Control"
      title="Operations Center"
      description="Real-time command view across orders, kitchen, tables, and staff"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard title="Live Orders" value={24} icon={Package} accent="orange" delay={0} />
        <MetricCard title="Kitchen Status" value="68%" hint="Moderate load" icon={ChefHat} accent="rose" delay={0.05} />
        <MetricCard title="Tables Active" value="18/25" icon={LayoutGrid} accent="violet" delay={0.1} />
        <MetricCard title="Cash Counter" value="Open" icon={CreditCard} accent="emerald" delay={0.15} />
        <MetricCard title="Online Orders" value={7} icon={MonitorDot} accent="sky" delay={0.2} />
        <MetricCard title="Staff Online" value={12} icon={Users} accent="amber" delay={0.25} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard hover className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Delivery Status</h3>
            <Badge variant="success">3 en route</Badge>
          </div>
          <div className="space-y-2">
            {[
              { id: "#1036", partner: "In-house", eta: "8 min", status: "En route" },
              { id: "#1034", partner: "Swiggy", eta: "14 min", status: "Picked up" },
              { id: "#1031", partner: "Zomato", eta: "22 min", status: "Preparing" }
            ].map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-brand-primary" />
                  <span className="font-mono text-sm text-brand-primary">{d.id}</span>
                  <span className="text-sm text-white/50">{d.partner}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{d.eta}</Badge>
                  <Badge variant="default">{d.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard hover>
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-primary" />
            <h3 className="text-base font-semibold text-white">Recent Events</h3>
          </div>
          <div className="space-y-3">
            {liveEvents.map((e, i) => (
              <div key={i} className="border-l-2 border-brand-primary/30 pl-3">
                <p className="text-sm text-white/75">{e.event}</p>
                <p className="text-[10px] text-white/35">{e.time}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-base font-semibold text-white">Live Orders Feed</h3>
          <p className="text-xs text-white/40">Realtime Firestore sync · status overrides enabled</p>
        </div>
        <div className="p-4 sm:p-5">
          <ManagerOrdersPageFeature />
        </div>
      </GlassCard>
    </PageShell>
  );
}
