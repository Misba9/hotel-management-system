import {
  RestaurantOrderStatus,
  normalizeRestaurantOrderStatusForTransition
} from "./restaurant-order-status";
import { isWaiterPosDineInOrder } from "./waiter-pos-order";

/**
 * Manager / admin “kitchen board” tabs: all orders, filtered in-memory after a timeline query.
 * @see {@link managerOrderMatchesTab}
 */
export type ManagerOrdersTab = "all" | "placed" | "preparing" | "ready" | "completed";

/** Bucket used for filters + SLA delay styling (not every bucket has its own tab). */
export type ManagerOrderVisualBucket =
  | "placed"
  | "preparing"
  | "ready"
  | "completed"
  | "served"
  | "cancelled"
  | "other";

export function getManagerOrderVisualBucket(order: {
  status?: string;
  orderType?: string;
}): ManagerOrderVisualBucket {
  const upper = String(order.status ?? "").trim().toUpperCase();
  if (["CANCELLED", "CANCELED", "REJECTED"].includes(upper)) return "cancelled";

  const ot = String(order.orderType ?? "").toLowerCase();
  if (ot === "table") {
    const canon = normalizeRestaurantOrderStatusForTransition(order.status);
    if (canon === "blocked") return "cancelled";
    if (canon === RestaurantOrderStatus.PLACED) return "placed";
    if (canon === RestaurantOrderStatus.PREPARING) return "preparing";
    if (canon === RestaurantOrderStatus.READY) return "ready";
    if (canon === RestaurantOrderStatus.COMPLETED) return "completed";
    if (canon === RestaurantOrderStatus.SERVED) return "served";
    return "other";
  }

  if (isWaiterPosDineInOrder(order)) {
    const sl = String(order.status ?? "").toLowerCase().trim();
    if (sl === "pending") return "placed";
    if (sl === "preparing") return "preparing";
    if (sl === "ready") return "ready";
    if (sl === "done" || sl === "served" || sl === "completed") return "completed";
    return "other";
  }

  const sl = String(order.status ?? "").toLowerCase().trim();
  if (sl === "pending" || sl === "created" || sl === "confirmed") return "placed";
  if (sl === "accepted" || sl === "preparing") return "preparing";
  if (sl === "ready" || sl === "out_for_delivery" || sl === "picked_up") return "ready";
  if (sl === "delivered" || sl === "completed") return "completed";
  return "other";
}

export function managerOrderMatchesTab(
  order: { status?: string; orderType?: string },
  tab: ManagerOrdersTab
): boolean {
  if (tab === "all") return true;
  return getManagerOrderVisualBucket(order) === tab;
}

export function orderAgeMinutesFromIso(createdAtIso: string | null | undefined): number | null {
  if (!createdAtIso) return null;
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 60_000;
}

/** [warnMinutes, criticalMinutes] from first entering this stage — uses createdAt as proxy (no per-stage timestamps). */
const DELAY_THRESHOLDS_MIN: Partial<Record<ManagerOrderVisualBucket, [number, number]>> = {
  placed: [12, 28],
  preparing: [15, 40],
  ready: [8, 20],
  served: [12, 35]
};

export type ManagerDelaySeverity = "none" | "warn" | "critical";

export function managerOrderDelaySeverity(
  bucket: ManagerOrderVisualBucket,
  ageMinutes: number | null
): ManagerDelaySeverity {
  if (ageMinutes == null) return "none";
  const t = DELAY_THRESHOLDS_MIN[bucket];
  if (!t) return "none";
  const [warn, critical] = t;
  if (ageMinutes >= critical) return "critical";
  if (ageMinutes >= warn) return "warn";
  return "none";
}
