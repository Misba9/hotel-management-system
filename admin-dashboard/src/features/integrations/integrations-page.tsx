"use client";

import { CheckCircle2, Link2, RefreshCw, XCircle } from "lucide-react";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const integrations = [
  { name: "Swiggy", category: "Delivery", status: "connected" as const, lastSync: "2m ago" },
  { name: "Zomato", category: "Delivery", status: "connected" as const, lastSync: "5m ago" },
  { name: "ONDC", category: "Delivery", status: "pending" as const, lastSync: "—" },
  { name: "Razorpay", category: "Payments", status: "connected" as const, lastSync: "Live" },
  { name: "PhonePe", category: "Payments", status: "connected" as const, lastSync: "Live" },
  { name: "Stripe", category: "Payments", status: "disconnected" as const, lastSync: "—" },
  { name: "WhatsApp", category: "Messaging", status: "connected" as const, lastSync: "1h ago" },
  { name: "Google Maps", category: "Location", status: "connected" as const, lastSync: "Active" }
];

const syncLogs = [
  { time: "14:32", service: "Swiggy", event: "Order sync completed — 3 new orders", status: "success" },
  { time: "14:28", service: "Razorpay", event: "Webhook received — payment confirmed", status: "success" },
  { time: "14:15", service: "Zomato", event: "Menu sync failed — retry scheduled", status: "error" },
  { time: "13:58", service: "WhatsApp", event: "Template message delivered", status: "success" }
];

export function IntegrationsPageFeature() {
  return (
    <PageShell badge="Integrations" title="Connected Services" description="Delivery · payments · messaging · maps">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {integrations.map((item) => (
          <GlassCard key={item.name} hover className="flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{item.name}</h3>
                <p className="text-xs text-white/40">{item.category}</p>
              </div>
              {item.status === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : item.status === "pending" ? (
                <RefreshCw className="h-5 w-5 text-amber-400" />
              ) : (
                <XCircle className="h-5 w-5 text-white/30" />
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={item.status === "connected" ? "success" : item.status === "pending" ? "warning" : "neutral"}>
                {item.status}
              </Badge>
              <span className="text-[10px] text-white/35">Sync: {item.lastSync}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1">
                <Link2 className="h-3 w-3" />
                {item.status === "disconnected" ? "Connect" : "Manage"}
              </Button>
              {item.status === "connected" ? (
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard hover>
        <h3 className="mb-4 font-semibold text-white">Sync Logs</h3>
        <div className="space-y-2">
          {syncLogs.map((log, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/35">{log.time}</span>
                <span className="text-sm font-medium text-brand-primary">{log.service}</span>
                <span className="text-sm text-white/60">{log.event}</span>
              </div>
              <Badge variant={log.status === "success" ? "success" : "danger"}>{log.status}</Badge>
            </div>
          ))}
        </div>
      </GlassCard>
    </PageShell>
  );
}
