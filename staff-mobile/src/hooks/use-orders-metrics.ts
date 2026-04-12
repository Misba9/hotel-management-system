import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { staffDb } from "../lib/firebase";

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
  /** Snapshot size (capped query). */
  orderCount: number;
  /** Sum of `total` / `totalAmount` for orders with status `delivered`. */
  deliveredRevenue: number;
  /** Orders not in terminal states. */
  openOrders: number;
  /** Count per status string. */
  byStatus: Record<string, number>;
  /** Recent orders (newest first) for lists. */
  recentOrders: OrderDocShape[];
};

export const STAFF_ORDERS_QUERY_LIMIT = 200;

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
    orderCount: 0,
    deliveredRevenue: 0,
    openOrders: 0,
    byStatus: {},
    recentOrders: []
  });

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    /** `limit` only — no composite index; sort by `createdAt` in memory below. */
    const q = query(collection(staffDb, "orders"), limit(STAFF_ORDERS_QUERY_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const byStatus: Record<string, number> = {};
        let deliveredRevenue = 0;
        let openOrders = 0;
        const terminal = new Set(["delivered", "cancelled", "rejected"]);
        const recent: OrderDocShape[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const o = normalizeOrder(docSnap.id, data);
          recent.push(o);
          const s = (o.status ?? "unknown").toLowerCase();
          byStatus[s] = (byStatus[s] ?? 0) + 1;
          const amount = Number(o.total ?? o.totalAmount ?? 0);
          if (s === "delivered") deliveredRevenue += Number.isFinite(amount) ? amount : 0;
          if (!terminal.has(s)) openOrders += 1;
        });

        recent.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });

        setState({
          loading: false,
          error: null,
          orderCount: snap.size,
          deliveredRevenue,
          openOrders,
          byStatus,
          recentOrders: recent
        });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load orders"
        }));
      }
    );

    return () => unsub();
  }, [enabled, listenerKey]);

  return state;
}
