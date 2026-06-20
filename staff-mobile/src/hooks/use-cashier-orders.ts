import { useEffect, useMemo } from "react";
import { subscribeRecentOrders } from "../../services/orders";
import {
  buildCashierOrdersView,
  mergeCashierOrders,
  type CashierOrdersView
} from "../lib/pos/cashier-orders-view";
import { useCashierPosStore } from "../lib/pos/cashier-pos-store";

/**
 * Single Firestore subscription for the cashier POS — syncs into Zustand once.
 * Mount exactly once (e.g. PosDashboard).
 */
export function useCashierOrdersSubscription(enabled = true) {
  const setFirestoreOrders = useCashierPosStore((s) => s.setFirestoreOrders);

  useEffect(() => {
    if (!enabled) {
      setFirestoreOrders([], false, null);
      return undefined;
    }

    setFirestoreOrders([], true, null);
    const unsub = subscribeRecentOrders(
      (list) => setFirestoreOrders(list, false, null),
      (err) =>
        setFirestoreOrders(
          [],
          false,
          err instanceof Error ? err.message : "Could not load orders."
        )
    );
    return unsub;
  }, [enabled, setFirestoreOrders]);
}

/**
 * Per-platform order buckets, counts, and filtered lists from one merged order set.
 */
export function useCashierOrders(): CashierOrdersView & { loading: boolean; error: string | null } {
  const firestoreOrders = useCashierPosStore((s) => s.firestoreOrders);
  const testOrders = useCashierPosStore((s) => s.testOrders);
  const ordersLoading = useCashierPosStore((s) => s.ordersLoading);
  const ordersError = useCashierPosStore((s) => s.ordersError);
  const platformFilter = useCashierPosStore((s) => s.platformFilter);
  const statusFilters = useCashierPosStore((s) => s.statusFilters);
  const orderSearch = useCashierPosStore((s) => s.orderSearch);

  const allOrders = useMemo(
    () => mergeCashierOrders(firestoreOrders, testOrders),
    [firestoreOrders, testOrders]
  );

  const view = useMemo(
    () => buildCashierOrdersView(allOrders, platformFilter, statusFilters, orderSearch),
    [allOrders, platformFilter, statusFilters, orderSearch]
  );

  return {
    ...view,
    loading: ordersLoading,
    error: ordersError
  };
}

/** Resolve a single order from the canonical list. */
export function useCashierOrderById(orderId: string | null) {
  const { allOrders } = useCashierOrders();
  return useMemo(
    () => (orderId ? allOrders.find((o) => o.id === orderId) ?? null : null),
    [allOrders, orderId]
  );
}
