import { useMemo } from "react";
import type { StaffOrderRow } from "../../services/orders";
import { mergeCashierOrders } from "../lib/pos/cashier-orders-view";
import { useCashierPosStore } from "../lib/pos/cashier-pos-store";

/**
 * @deprecated Prefer `useCashierOrders` from `./use-cashier-orders`.
 * Reads the canonical merged order list from the shared cashier store.
 */
export function useCashierActiveOrders(_enabled = true) {
  const firestoreOrders = useCashierPosStore((s) => s.firestoreOrders);
  const testOrders = useCashierPosStore((s) => s.testOrders);
  const loading = useCashierPosStore((s) => s.ordersLoading);
  const error = useCashierPosStore((s) => s.ordersError);

  const orders = useMemo(
    (): StaffOrderRow[] => mergeCashierOrders(firestoreOrders, testOrders),
    [firestoreOrders, testOrders]
  );

  return { orders, loading, error };
}
