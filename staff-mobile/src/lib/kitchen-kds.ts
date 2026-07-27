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
  preparingStartedAt?: string;
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
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  const ms = Date.now() - t;
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 60000);
}

export function formatElapsed(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min`;
  // Cap absurd values from bad/legacy timestamps (e.g. epoch misreads).
  if (m > 24 * 60) return "Just now";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/** Ready-queue wait clock — minutes-first, keyed off readyAt only. */
export function formatReadyWaiting(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return "Waiting • just now";
  if (m > 24 * 60) return "Waiting • just now";
  return `Waiting • ${m} min`;
}

/** Kitchen prep clock — minutes only, keyed off preparingStartedAt / preparingAt. */
export function formatPreparingElapsed(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return "Preparing • just now";
  return `Preparing • ${m} min`;
}

export function resolvePreparingStartedIso(order: Pick<KitchenOrder, "preparingStartedAt" | "preparingAt">): string | null {
  return order.preparingStartedAt ?? order.preparingAt ?? null;
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
