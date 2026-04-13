/** Terminal lifecycle — excluded from “active pipeline” counts. */
export const TERMINAL_ORDER_STATUSES = new Set(["delivered", "cancelled", "rejected"]);

export type OrderLike = {
  status?: string | null;
  total?: number | null;
  totalAmount?: number | null;
};

export function orderTotalAmount(order: OrderLike): number {
  const t = order.totalAmount ?? order.total;
  const n = typeof t === "number" ? t : Number(t);
  return Number.isFinite(n) ? n : 0;
}

export type DashboardMetrics = {
  totalOrders: number;
  /** In-flight pipeline: not delivered / cancelled / rejected. */
  activeOrders: number;
  deliveredOrders: number;
  /** Sum of order totals for `delivered` rows only. */
  revenue: number;
};

/**
 * Aggregates dashboard KPIs from an order list (e.g. a capped Firestore snapshot).
 * Updates live when the underlying `onSnapshot` emits.
 */
export function computeDashboardMetrics(orders: OrderLike[]): DashboardMetrics {
  return orders.reduce(
    (acc, order) => {
      const st = String(order.status ?? "").toLowerCase();
      acc.totalOrders += 1;
      if (st === "delivered") {
        acc.deliveredOrders += 1;
        acc.revenue += orderTotalAmount(order);
      } else if (!TERMINAL_ORDER_STATUSES.has(st)) {
        acc.activeOrders += 1;
      }
      return acc;
    },
    { totalOrders: 0, activeOrders: 0, deliveredOrders: 0, revenue: 0 }
  );
}
