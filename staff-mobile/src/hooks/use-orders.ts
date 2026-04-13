import { useCallback, useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "./useAuth";
import {
  subscribeDeliveryOrders,
  subscribeKitchenOrders,
  subscribeToOrders
} from "../services/orders.js";
import { formatFirestoreIndexErrorMessage, isFirestoreCompositeIndexError } from "../lib/firestore-query-errors";

/** JSDoc `StaffOrder` from {@link mapOrderDoc} in `orders.js`. */
export type StaffOrder = import("../services/orders.js").StaffOrder;

export type OrdersRole = "kitchen" | "delivery" | "manager" | "admin";

export type UseOrdersOptions = {
  /** When false, no subscription (e.g. gated route). Defaults to true. */
  enabled?: boolean;
};

export type UseOrdersResult = {
  orders: StaffOrder[];
  loading: boolean;
  error: string | null;
  /** True until the next snapshot after {@link refresh}. */
  refreshing: boolean;
  /** Rebind listener (e.g. pull-to-refresh). */
  refresh: () => void;
  /** After an error: clear message and resubscribe. */
  retry: () => void;
};

function mapSubscribeError(err: unknown, role: OrdersRole): string {
  const code = err instanceof FirebaseError ? err.code : "";
  if (code === "permission-denied") {
    if (role === "kitchen") {
      return "Firestore blocked reading orders. Check security rules for kitchen access.";
    }
    if (role === "delivery") {
      return "Firestore blocked reading orders. Check security rules for your role.";
    }
    return "No permission to read orders (check Firestore rules for your role).";
  }
  if (isFirestoreCompositeIndexError(err)) {
    const { body, indexUrl } = formatFirestoreIndexErrorMessage(err);
    return indexUrl ? `${body}\n\n${indexUrl}` : body;
  }
  if (role === "kitchen") return err instanceof Error ? err.message : "Could not load kitchen queue.";
  if (role === "delivery") return err instanceof Error ? err.message : "Could not load deliveries.";
  return err instanceof Error ? err.message : "Could not sync orders.";
}

/**
 * Real-time `orders` subscription filtered by staff role (see `subscribe*` in `orders.js`).
 *
 * @example
 * const { orders, loading, error, refresh, refreshing } = useOrders("kitchen");
 */
export function useOrders(role: OrdersRole, options: UseOrdersOptions = {}): UseOrdersResult {
  const { enabled = true } = options;
  const { user } = useAuth();
  const deliveryUid = user?.uid ?? "";

  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listenerKey, setListenerKey] = useState(0);

  /** Reset queue when identity or role scope changes. */
  useEffect(() => {
    setOrders([]);
    setError(null);
    setListenerKey(0);
    if (enabled && (role !== "delivery" || deliveryUid)) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [role, deliveryUid, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      setOrders([]);
      setError(null);
      return undefined;
    }

    if (role === "delivery" && !deliveryUid) {
      setLoading(false);
      setRefreshing(false);
      setOrders([]);
      setError(null);
      return undefined;
    }

    setError(null);

    const onData = (list: StaffOrder[]) => {
      setOrders(list);
      setLoading(false);
      setRefreshing(false);
    };

    const onErr = (err: unknown) => {
      setLoading(false);
      setRefreshing(false);
      setError(mapSubscribeError(err, role));
    };

    let unsub: () => void;
    if (role === "kitchen") {
      unsub = subscribeKitchenOrders(onData, onErr);
    } else if (role === "delivery") {
      unsub = subscribeDeliveryOrders(deliveryUid, onData, onErr);
    } else {
      unsub = subscribeToOrders(onData, onErr);
    }

    return () => {
      unsub();
    };
  }, [role, deliveryUid, listenerKey, enabled]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setListenerKey((k) => k + 1);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setRefreshing(true);
    setListenerKey((k) => k + 1);
  }, []);

  return {
    orders,
    loading,
    error,
    refreshing,
    refresh,
    retry
  };
}
