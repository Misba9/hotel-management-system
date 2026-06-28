"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { motion } from "framer-motion";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { OrdersPageFeature } from "@/features/orders/orders-page";
import { PageShell } from "@/components/admin/page-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";

type Channel = "all" | "dine_in" | "takeaway" | "delivery" | "online" | "completed" | "cancelled";

type KanbanOrder = {
  id: string;
  customer?: string;
  table?: string;
  total: number;
  status: string;
  orderType?: string;
  createdAt?: string;
};

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "all", label: "All" },
  { id: "dine_in", label: "Dine In" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
  { id: "online", label: "Online" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" }
];

function matchesChannel(order: KanbanOrder, channel: Channel) {
  if (channel === "all") return true;
  if (channel === "completed") return ["done", "delivered", "completed", "served"].includes(order.status.toLowerCase());
  if (channel === "cancelled") return ["cancelled", "rejected"].includes(order.status.toLowerCase());
  const type = (order.orderType ?? "").toLowerCase();
  if (channel === "dine_in") return type.includes("dine") || Boolean(order.table);
  if (channel === "takeaway") return type.includes("takeaway") || type.includes("pickup");
  if (channel === "delivery") return type.includes("delivery");
  if (channel === "online") return type.includes("online") || type.includes("app");
  return true;
}

export function OrdersHubFeature() {
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel>("all");
  const [orders, setOrders] = useState<KanbanOrder[]>([]);

  useEffect(() => {
    if (!user || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id.slice(-8).toUpperCase(),
            customer: data.customerName ?? "Guest",
            table: data.tableName ?? (data.tableNumber ? `T-${data.tableNumber}` : undefined),
            total: Number(data.totalAmount ?? data.total ?? 0),
            status: String(data.status ?? "pending"),
            orderType: data.orderType,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined
          };
        })
      );
    });
    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => orders.filter((o) => matchesChannel(o, channel)), [orders, channel]);

  return (
    <PageShell badge="Order Pipeline" title="Orders" description="Kanban view · realtime updates · multi-channel">
      <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
        <TabsList className="mb-4 flex-wrap">
          {CHANNELS.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.slice(0, 9).map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <GlassCard hover className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-brand-primary">#{order.id}</p>
                  <p className="mt-0.5 text-sm text-theme-text-secondary">{order.customer}</p>
                  {order.table ? <p className="text-xs text-theme-text-secondary">{order.table}</p> : null}
                </div>
                <Badge variant="neutral">{order.status}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-theme-text-primary">{formatCurrency(order.total)}</span>
                <span className="text-[10px] text-theme-text-disabled">
                  {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-theme-border px-5 py-3">
          <p className="text-sm font-medium text-theme-text-secondary">Full order management</p>
        </div>
        <div className="p-4 sm:p-5">
          <OrdersPageFeature />
        </div>
      </GlassCard>
    </PageShell>
  );
}
