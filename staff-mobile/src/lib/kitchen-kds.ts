import { normalizeOrderStatus } from "@shared/utils/canonical-order-fields";

import type { StaffOrderRow } from "../../services/orders";

export type KitchenOrderStatus = "new" | "accepted" | "preparing" | "ready";

export type KitchenOrderItem = {
  productId: number | string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type KitchenOrder = {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  source: "dine-in" | "takeaway" | "zomato" | "swiggy";
  total: number;
  status: KitchenOrderStatus;
  createdAt: string;
  specialNotes?: string;
  customerName?: string;
  orderType?: string;
  waiterName?: string;
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  items: KitchenOrderItem[];
};

export function resolveKitchenQueueStatus(order: StaffOrderRow): KitchenOrderStatus | null {
  const canon = normalizeOrderStatus(String(order.status ?? ""));
  if (canon === "cancelled" || canon === "completed") return null;
  if (canon === "ready") return "ready";
  if (canon === "preparing") return "preparing";
  if (canon === "accepted") return "accepted";
  if (canon === "new") return "new";
  return null;
}

export function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

export function formatElapsed(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function formatSource(source: KitchenOrder["source"]): string {
  const labels: Record<KitchenOrder["source"], string> = {
    "dine-in": "Dine-in",
    takeaway: "Takeaway",
    zomato: "Zomato",
    swiggy: "Swiggy"
  };
  return labels[source];
}

export function formatKitchenTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function isKitchenUrgent(iso: string, thresholdMinutes = 15): boolean {
  return minutesSince(iso) >= thresholdMinutes;
}
