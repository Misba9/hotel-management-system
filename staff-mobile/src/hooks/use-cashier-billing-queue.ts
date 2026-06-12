import { useEffect, useState } from "react";
import type { QuerySnapshot } from "firebase/firestore";
import {
  formatFirestoreListenerError,
  isFirestoreCompositeIndexError,
  logFirestoreQueryError
} from "../lib/firestore-query-errors";
import { subscribeFirestoreQuery } from "../lib/firestore-listener";
import {
  getBillingFallbackQuery,
  getBillingQuery,
  isBillingEligibleStatus,
  isBillingPendingPayment
} from "../queries/billingQuery";
import { mapOrderDoc } from "../services/orders.js";
import type { StaffOrderRow } from "../../services/orders";

function mapBillingDoc(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDoc(id, data);
  return {
    ...base,
    orderType: typeof data.orderType === "string" ? data.orderType : undefined,
    tableNumber:
      typeof data.tableNumber === "number"
        ? data.tableNumber
        : typeof data.tableNumber === "string"
          ? Number(data.tableNumber) || undefined
          : undefined,
    tableId: typeof data.tableId === "string" ? data.tableId : undefined,
    tableName: typeof data.tableName === "string" ? data.tableName : undefined,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined,
    tokenNumber: typeof data.tokenNumber === "number" ? data.tokenNumber : undefined,
    printed: typeof data.printed === "boolean" ? data.printed : undefined,
    canonicalStatus: "served"
  };
}

function applyBillingSnapshot(snapshot: QuerySnapshot): StaffOrderRow[] {
  return snapshot.docs
    .filter((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return isBillingEligibleStatus(data.status) && isBillingPendingPayment(data.paymentStatus);
    })
    .map((docSnap) => mapBillingDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
}

export function useCashierBillingQueue() {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = getBillingQuery();
    if (!q) {
      setOrders([]);
      setLoading(false);
      setError("Billing query is unavailable.");
      return undefined;
    }
    setLoading(true);
    setError(null);
    let active = true;
    let unsubPrimary = () => {};
    let unsubFallback = () => {};
    let fallbackStarted = false;

    const onNext = (snapshot: QuerySnapshot) => {
      if (!active) return;
      setOrders(applyBillingSnapshot(snapshot));
      setLoading(false);
      setError(null);
    };

    const onErr = (snapshotError: unknown) => {
      if (!active) return;
      if (!isFirestoreCompositeIndexError(snapshotError)) {
        setOrders([]);
        setLoading(false);
        setError(formatFirestoreListenerError(snapshotError));
        return;
      }
      if (fallbackStarted) return;
      fallbackStarted = true;
      logFirestoreQueryError("cashierBilling", snapshotError);
      unsubPrimary();
      const fallbackQuery = getBillingFallbackQuery();
      if (!fallbackQuery) {
        setOrders([]);
        setLoading(false);
        setError(formatFirestoreListenerError(snapshotError));
        return;
      }
      unsubFallback = subscribeFirestoreQuery(
        "cashierBilling:fallback",
        fallbackQuery,
        onNext,
        (fallbackError) => {
          if (!active) return;
          setOrders([]);
          setLoading(false);
          setError(formatFirestoreListenerError(fallbackError));
        }
      );
    };

    unsubPrimary = subscribeFirestoreQuery("cashierBilling", q, onNext, onErr);

    return () => {
      active = false;
      unsubPrimary();
      unsubFallback();
    };
  }, []);

  return { orders, loading, error };
}
