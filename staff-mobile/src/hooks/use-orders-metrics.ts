import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { computeDashboardMetrics } from "../lib/order-dashboard-metrics";
import { formatFirestoreIndexErrorMessage, isFirestoreCompositeIndexError } from "../lib/firestore-query-errors";
import { staffDb } from "../lib/firebase";
import { MANAGER_ORDERS_LIMIT } from "../services/orders.js";

export type OrderDocShape = {
  id: string;
  status?: string;
  total?: number;
  totalAmount?: number;
  createdAt?: string;
  customerName?: string;
  orderType?: string;
};

export type OrdersMetricsState = {
  loading: boolean;
  error: string | null;
  /** Rows in the current snapshot (capped query). */
  totalOrders: number;
  /** Pipeline orders (not delivered / cancelled / rejected). */
  activeOrders: number;
  /** Count with status `delivered`. */
  deliveredOrders: number;
  /** Sum of `total` / `totalAmount` for delivered orders only. */
  revenue: number;
  /** Count per status string (sample). */
  byStatus: Record<string, number>;
  /** Recent orders (newest first) for lists. */
  recentOrders: OrderDocShape[];
};

/** @deprecated Use {@link MANAGER_ORDERS_LIMIT} from `orders.js` — kept for import sites. */
export const STAFF_ORDERS_QUERY_LIMIT = MANAGER_ORDERS_LIMIT;

function toIsoTime(data: Record<string, unknown>): string | undefined {
  const v = data.createdAt;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === "string") return v;
  return undefined;
}

function normalizeOrder(id: string, data: Record<string, unknown>): OrderDocShape {
  return {
    id,
    status: typeof data.status === "string" ? data.status : undefined,
    total: typeof data.total === "number" ? data.total : undefined,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : undefined,
    createdAt: toIsoTime(data),
    customerName: typeof data.customerName === "string" ? data.customerName : undefined,
    orderType: typeof data.orderType === "string" ? data.orderType : typeof data.type === "string" ? data.type : undefined
  };
}

/**
 * @param listenerKey Increment to re-subscribe (error retry, pull-to-refresh).
 */
export function useOrdersMetrics(enabled = true, listenerKey = 0): OrdersMetricsState {
  const [state, setState] = useState<OrdersMetricsState>({
    loading: true,
    error: null,
    totalOrders: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    revenue: 0,
    byStatus: {},
    recentOrders: []
  });

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    /** Manager: newest-first window (role-gated in UI). */
    const q = query(
      collection(staffDb, "orders"),
      orderBy("createdAt", "desc"),
      limit(MANAGER_ORDERS_LIMIT)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const byStatus: Record<string, number> = {};
        const recent: OrderDocShape[] = [];
        const forMetrics: Array<{ status?: string; total?: number; totalAmount?: number }> = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const o = normalizeOrder(docSnap.id, data);
          recent.push(o);
          const s = (o.status ?? "unknown").toLowerCase();
          byStatus[s] = (byStatus[s] ?? 0) + 1;
          forMetrics.push({
            status: o.status,
            total: o.total,
            totalAmount: o.totalAmount
          });
        });

        const { totalOrders, activeOrders, deliveredOrders, revenue } = computeDashboardMetrics(forMetrics);

        recent.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });

        setState({
          loading: false,
          error: null,
          totalOrders,
          activeOrders,
          deliveredOrders,
          revenue,
          byStatus,
          recentOrders: recent
        });
      },
      (err) => {
        const msg = isFirestoreCompositeIndexError(err)
          ? formatFirestoreIndexErrorMessage(err).body
          : err instanceof Error
            ? err.message
            : "Failed to load orders";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: msg
        }));
      }
    );

    return () => unsub();
  }, [enabled, listenerKey]);

  return state;
}
