import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { staffDb } from "@/lib/staff-db";
import { useAuth } from "@/contexts/AuthContext";
import type { StaffOrderRow } from "@/services/orders";

type Props = {
  orders: StaffOrderRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type InventoryDoc = {
  id: string;
  ingredientName: string;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
};

type PrinterDoc = {
  id: string;
  name: string;
  isOnline: boolean;
  lastHeartbeatAt: unknown;
};

type NotificationDoc = {
  id: string;
  title: string;
  body: string;
  seen: boolean;
  createdAt: unknown;
  type?: string;
};

type ManagerNotificationType =
  | "kitchen_delay"
  | "low_stock"
  | "printer_offline"
  | "refund_approval"
  | "discount_approval"
  | "new_online_order"
  | "swiggy"
  | "zomato"
  | "push_inbox";

type ManagerNotificationEvent = {
  id: string;
  type: ManagerNotificationType;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  createdAt: Date;
};

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function orderSource(order: StaffOrderRow): string {
  return (order.source ?? order.orderType ?? "direct").toString().toLowerCase();
}

function orderStatus(order: StaffOrderRow): string {
  return (order.canonicalStatus || order.status || "").toString().toLowerCase();
}

function statusClass(severity: "high" | "medium" | "low"): string {
  if (severity === "high") return "border-rose-500/30 bg-rose-500/10";
  if (severity === "medium") return "border-amber-500/30 bg-amber-500/10";
  return "border-theme-border bg-theme-card";
}

function typeLabel(type: ManagerNotificationType): string {
  if (type === "kitchen_delay") return "Kitchen Delay";
  if (type === "low_stock") return "Low Stock";
  if (type === "printer_offline") return "Printer Offline";
  if (type === "refund_approval") return "Refund Approval";
  if (type === "discount_approval") return "Discount Approval";
  if (type === "new_online_order") return "New Online Order";
  if (type === "swiggy") return "Swiggy";
  if (type === "zomato") return "Zomato";
  return "Push Inbox";
}

export function ManagerNotificationCenter({ orders, loading, lastUpdated }: Props) {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<InventoryDoc[]>([]);
  const [printers, setPrinters] = useState<PrinterDoc[]>([]);
  const [pushFeed, setPushFeed] = useState<NotificationDoc[]>([]);
  const [filter, setFilter] = useState<ManagerNotificationType | "all">("all");

  useEffect(() => {
    const unsubInventory = subscribeFirestoreQuery(
      "managerNotifications.inventory",
      collection(staffDb, "inventory"),
      (snap) => {
        setInventory(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              ingredientName:
                (typeof data.ingredientName === "string" && data.ingredientName) ||
                (typeof data.name === "string" && data.name) ||
                d.id,
              currentStock: Number(data.currentStock ?? 0),
              minStock: Math.max(1, Number(data.minStock ?? 1)),
              isLowStock: data.isLowStock === true
            };
          })
        );
      }
    );

    const unsubPrinters = subscribeFirestoreQuery(
      "managerNotifications.printers",
      collection(staffDb, "printers"),
      (snap) => {
        setPrinters(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: (typeof data.name === "string" && data.name) || d.id,
              isOnline: data.isOnline !== false && data.online !== false,
              lastHeartbeatAt: data.lastHeartbeatAt ?? data.updatedAt ?? null
            };
          })
        );
      }
    );

    return () => {
      unsubInventory();
      unsubPrinters();
    };
  }, []);

  useEffect(() => {
    const uid = profile?.uid?.trim();
    if (!uid) return;
    const q = query(
      collection(staffDb, "notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = subscribeFirestoreQuery(
      "managerNotifications.pushInbox",
      q,
      (snap) => {
        setPushFeed(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              title: (typeof data.title === "string" && data.title) || "Notification",
              body: (typeof data.body === "string" && data.body) || "",
              seen: data.seen === true,
              createdAt: data.createdAt,
              type: typeof data.type === "string" ? data.type : undefined
            };
          })
        );
      }
    );
    return () => unsub();
  }, [profile?.uid]);

  const events = useMemo<ManagerNotificationEvent[]>(() => {
    const out: ManagerNotificationEvent[] = [];
    const now = Date.now();

    for (const order of orders) {
      const status = orderStatus(order);
      const source = orderSource(order);
      const createdAt = toDate(order.createdAt) ?? new Date();
      const ageMin = Math.max(0, Math.floor((now - createdAt.getTime()) / 60000));
      if (["new", "accepted", "preparing", "ready"].includes(status) && ageMin >= 20) {
        out.push({
          id: `kdelay-${order.id}`,
          type: "kitchen_delay",
          title: "Kitchen delay",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} delayed ${ageMin}m`,
          severity: ageMin >= 35 ? "high" : "medium",
          createdAt
        });
      }
      if (status === "new" && (source === "online" || source === "website")) {
        out.push({
          id: `online-${order.id}`,
          type: "new_online_order",
          title: "New online order",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} received`,
          severity: "medium",
          createdAt
        });
      }
      if (status === "new" && source === "swiggy") {
        out.push({
          id: `swiggy-${order.id}`,
          type: "swiggy",
          title: "Swiggy order",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} is new`,
          severity: "medium",
          createdAt
        });
      }
      if (status === "new" && source === "zomato") {
        out.push({
          id: `zomato-${order.id}`,
          type: "zomato",
          title: "Zomato order",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} is new`,
          severity: "medium",
          createdAt
        });
      }

      const raw = order as Record<string, unknown>;
      const discountPending = raw.discountRequested === true && raw.managerDiscountApproved !== true;
      if (discountPending) {
        out.push({
          id: `discount-${order.id}`,
          type: "discount_approval",
          title: "Discount approval required",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} requests manager discount approval`,
          severity: "medium",
          createdAt: toDate(raw.discountRequestedAt) ?? createdAt
        });
      }
      const refundPending = raw.refundRequested === true && raw.managerRefundApproved !== true;
      if (refundPending) {
        out.push({
          id: `refund-${order.id}`,
          type: "refund_approval",
          title: "Refund approval required",
          description: `Order #${order.tokenNumber ?? order.id.slice(-6)} requests refund approval`,
          severity: "high",
          createdAt: toDate(raw.refundRequestedAt) ?? createdAt
        });
      }
    }

    for (const item of inventory) {
      if (item.currentStock <= item.minStock || item.isLowStock) {
        out.push({
          id: `low-stock-${item.id}`,
          type: "low_stock",
          title: "Low stock",
          description: `${item.ingredientName}: ${item.currentStock} left (min ${item.minStock})`,
          severity: item.currentStock <= 0 ? "high" : item.currentStock <= Math.max(1, item.minStock * 0.5) ? "high" : "medium",
          createdAt: new Date()
        });
      }
    }

    for (const printer of printers) {
      const lastBeat = toDate(printer.lastHeartbeatAt);
      const stale = lastBeat ? now - lastBeat.getTime() > 10 * 60 * 1000 : true;
      const offline = !printer.isOnline || stale;
      if (offline) {
        out.push({
          id: `printer-${printer.id}`,
          type: "printer_offline",
          title: "Printer offline",
          description: `${printer.name} is offline or stale`,
          severity: "high",
          createdAt: lastBeat ?? new Date()
        });
      }
    }

    for (const row of pushFeed) {
      out.push({
        id: `push-${row.id}`,
        type: "push_inbox",
        title: row.title,
        description: row.body || "New push notification",
        severity: row.seen ? "low" : "medium",
        createdAt: toDate(row.createdAt) ?? new Date()
      });
    }

    out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return out.slice(0, 120);
  }, [orders, inventory, printers, pushFeed]);

  const badgeCounts = useMemo(() => {
    const map = new Map<ManagerNotificationType, number>();
    for (const event of events) {
      map.set(event.type, (map.get(event.type) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.type === filter)),
    [events, filter]
  );

  async function markPushInboxSeen() {
    const unseen = pushFeed.filter((row) => !row.seen);
    await Promise.all(unseen.map((row) => updateDoc(doc(staffDb, "notifications", row.id), { seen: true })));
  }

  const channelFilters: Array<{ id: ManagerNotificationType | "all"; label: string }> = [
    { id: "all", label: "All" },
    { id: "kitchen_delay", label: "Kitchen Delay" },
    { id: "low_stock", label: "Low Stock" },
    { id: "printer_offline", label: "Printer Offline" },
    { id: "refund_approval", label: "Refund Approval" },
    { id: "discount_approval", label: "Discount Approval" },
    { id: "new_online_order", label: "New Online" },
    { id: "swiggy", label: "Swiggy" },
    { id: "zomato", label: "Zomato" },
    { id: "push_inbox", label: "Push Inbox" }
  ];

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Notification Center</h3>
            <p className="text-xs text-theme-text-secondary">
              Realtime notification badges and push-ready event pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void markPushInboxSeen()}
              className="rounded-lg border border-theme-border bg-theme-card px-3 py-1.5 text-xs font-semibold text-theme-text-secondary hover:bg-theme-hover"
            >
              Mark Push Seen
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-theme-text-secondary">
          Last update:{" "}
          <span className="font-semibold text-theme-text-primary">
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
        </p>
      </header>

      <div className="p-4 md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {channelFilters.map((channel) => {
            const count = channel.id === "all" ? events.length : badgeCounts.get(channel.id) ?? 0;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => setFilter(channel.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === channel.id
                    ? "bg-theme-primary text-white"
                    : "border border-theme-border bg-theme-card text-theme-text-secondary hover:bg-theme-hover"
                }`}
              >
                {channel.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-theme-text-secondary">Loading notifications…</p>
        ) : (
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="rounded-xl border border-theme-border bg-theme-card px-3 py-4 text-sm text-theme-text-secondary">
                No notifications in this channel.
              </p>
            ) : (
              visible.map((event) => (
                <article
                  key={event.id}
                  className={`rounded-xl border px-3 py-3 ${statusClass(event.severity)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-theme-text-primary">{event.title}</p>
                    <span className="rounded-full bg-theme-hover px-2 py-0.5 text-[11px] font-semibold text-theme-text-secondary">
                      {typeLabel(event.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-theme-text-secondary">{event.description}</p>
                  <p className="mt-1 text-[11px] text-theme-text-disabled">
                    {event.createdAt.toLocaleString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short"
                    })}
                  </p>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
