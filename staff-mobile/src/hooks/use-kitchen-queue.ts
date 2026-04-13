import { useCallback, useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import {
  getRecentOrdersFallbackQuery,
  getRestaurantKitchenQueueQuery,
  RESTAURANT_KITCHEN_QUEUE_STATUS_IN
} from "../services/orders.js";
import { isFirestoreCompositeIndexError, logFirestoreQueryError } from "../lib/firestore-query-errors";

const STATUS_SET = new Set(RESTAURANT_KITCHEN_QUEUE_STATUS_IN);

export type KitchenQueueLine = {
  name: string;
  quantity: number;
};

export type KitchenQueueOrder = {
  id: string;
  status: string;
  tableNumber: number | null;
  orderType: string;
  items: KitchenQueueLine[];
  totalAmount: number;
  createdAt: Date | null;
};

function parseEmbeddedItems(raw: unknown): KitchenQueueLine[] {
  if (!Array.isArray(raw)) return [];
  const out: KitchenQueueLine[] = [];
  for (const row of raw) {
    if (row && typeof row === "object") {
      const o = row as { name?: string; quantity?: number; qty?: number };
      const name = String(o.name ?? "Item");
      const quantity = Number(o.quantity ?? o.qty ?? 1);
      out.push({ name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 });
    }
  }
  return out;
}

function readCreatedAt(data: Record<string, unknown>): Date | null {
  const ts = data.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return null;
}

function mapDoc(id: string, data: Record<string, unknown>): KitchenQueueOrder {
  const status = String(data.status ?? "").trim();
  const tn = data.tableNumber;
  const tableNumber = typeof tn === "number" && Number.isFinite(tn) ? tn : null;
  return {
    id,
    status,
    tableNumber,
    orderType: String(data.orderType ?? "").trim(),
    items: parseEmbeddedItems(data.items),
    totalAmount: Number(data.totalAmount ?? data.total ?? 0),
    createdAt: readCreatedAt(data)
  };
}

export type UseKitchenQueueResult = {
  orders: KitchenQueueOrder[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
};

/**
 * Realtime kitchen queue: `orders` where `status` in `PLACED`, `PREPARING` (restaurant table flow).
 * Uses composite `status` + `createdAt` when available; falls back to recent window + client filter.
 */
export function useKitchenQueue(enabled = true): UseKitchenQueueResult {
  const [orders, setOrders] = useState<KitchenQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listenKey, setListenKey] = useState(0);

  const refresh = useCallback(() => {
    setListenKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoading(false);
      setError(null);
      setRefreshing(false);
      return undefined;
    }

    setLoading(true);
    setError(null);
    let unsubFallback = () => {};

    const applyDocs = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
      const list: KitchenQueueOrder[] = [];
      for (const d of docs) {
        const data = d.data() || {};
        const st = String(data.status ?? "").trim();
        if (!STATUS_SET.has(st)) continue;
        list.push(mapDoc(d.id, data as Record<string, unknown>));
      }
      list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setOrders(list);
      setLoading(false);
      setRefreshing(false);
      setError(null);
    };

    const unsubPrimary = onSnapshot(
      getRestaurantKitchenQueueQuery(),
      (snap) => {
        applyDocs(snap.docs);
      },
      (err) => {
        if (!isFirestoreCompositeIndexError(err)) {
          logFirestoreQueryError("kitchen-queue-primary", err);
          setOrders([]);
          setLoading(false);
          setRefreshing(false);
          setError(err instanceof Error ? err.message : "Could not load kitchen queue.");
          return;
        }
        logFirestoreQueryError("kitchen-queue-fallback", err);
        unsubFallback = onSnapshot(
          getRecentOrdersFallbackQuery(),
          (snap) => {
            applyDocs(snap.docs);
          },
          (err2) => {
            logFirestoreQueryError("kitchen-queue-fallback-snapshot", err2);
            setOrders([]);
            setLoading(false);
            setRefreshing(false);
            setError(err2 instanceof Error ? err2.message : "Could not load kitchen queue.");
          }
        );
      }
    );

    return () => {
      unsubPrimary();
      unsubFallback();
    };
  }, [enabled, listenKey]);

  const refreshWithSpinner = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  return { orders, loading, error, refreshing, refresh: refreshWithSpinner };
}
