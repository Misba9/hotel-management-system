"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { normalizeOrderStatus } from "@shared/utils/canonical-order-fields";
import { formatItemExtras } from "@shared/lib/format-item-extras";
import { motion } from "framer-motion";
import { Clock, Maximize2, Package, Volume2 } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type KitchenOrder = {
  id: string;
  table?: string;
  items: Array<{ name: string; qty: number; extras?: string }>;
  status: string;
  canonicalStatus: string;
  createdAt?: string;
  orderType?: string;
  source?: string;
};

const COLUMNS = [
  { key: "new", label: "New", statuses: ["new"] as const },
  { key: "accepted", label: "Accepted", statuses: ["accepted"] as const },
  { key: "preparing", label: "Preparing", statuses: ["preparing"] as const },
  { key: "ready", label: "Ready", statuses: ["ready"] as const },
  { key: "completed", label: "Completed", statuses: ["completed"] as const }
] as const;

function orderMinutes(createdAt?: string) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
}

export function KitchenDisplayPageFeature() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!user || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(
        snap.docs.map((d) => {
          const data = d.data();
          const rawItems = Array.isArray(data.items) ? data.items : [];
          const items = rawItems.map((row: Record<string, unknown>) => ({
            name: String(row.name ?? "Item"),
            qty: Number(row.qty ?? row.quantity ?? 1),
            extras: formatItemExtras({
              modifications: Array.isArray(row.modifications) ? (row.modifications as string[]) : undefined,
              note: typeof row.note === "string" ? row.note : undefined
            })
          }));
          const canon = normalizeOrderStatus(String(data.status ?? ""));
          return {
            id: d.id.slice(-6).toUpperCase(),
            table: data.tableName ?? (data.tableNumber ? `T-${data.tableNumber}` : data.orderType ?? "—"),
            items,
            status: String(data.status ?? "new"),
            canonicalStatus: canon,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? undefined,
            orderType: data.orderType,
            source: typeof data.source === "string" ? data.source : undefined
          };
        })
      );
    });
    return () => unsub();
  }, [user]);

  const content = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) =>
          (col.statuses as readonly string[]).includes(o.canonicalStatus)
        );
        return (
          <GlassCard key={col.key} hover={false} className="flex flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-theme-text-primary">{col.label}</h3>
              <Badge variant="neutral">{colOrders.length}</Badge>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {colOrders.map((order, i) => {
                const mins = orderMinutes(order.createdAt);
                const urgent = mins > 15;
                return (
                  <motion.div
                    key={order.id + col.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-xl border p-3 ${
                      urgent ? "border-rose-500/30 bg-rose-500/5" : "border-theme-border bg-theme-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-brand-primary">#{order.id}</span>
                      {order.orderType === "delivery" ? <Badge variant="default">Delivery</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-theme-text-secondary">{order.table}</p>
                    {order.source ? (
                      <p className="mt-0.5 text-xs uppercase tracking-wide text-theme-text-secondary">{order.source}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-theme-text-secondary">
                        <Package className="h-3 w-3" />
                        {order.items.length} items
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${urgent ? "text-rose-400" : "text-theme-text-secondary"}`}>
                        <Clock className="h-3 w-3" />
                        {mins}m
                      </span>
                    </div>
                    {urgent ? <Badge variant="danger" className="mt-2">Priority</Badge> : null}
                  </motion.div>
                );
              })}
              {colOrders.length === 0 ? <p className="py-6 text-center text-xs text-theme-text-disabled">No orders</p> : null}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-text-primary">Kitchen Display</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">
              <Volume2 className="h-4 w-4" />
              Sound On
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setFullscreen(false)}>
              Exit Fullscreen
            </Button>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <PageShell
      badge="Kitchen Display System"
      title="Kitchen Queue"
      description="Realtime sync · sound alerts · priority tracking"
      action={
        <Button variant="secondary" size="sm" onClick={() => setFullscreen(true)}>
          <Maximize2 className="h-4 w-4" />
          Fullscreen
        </Button>
      }
    >
      {content}
    </PageShell>
  );
}
