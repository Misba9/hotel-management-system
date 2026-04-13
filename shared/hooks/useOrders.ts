import { useCallback } from "react";
import { collection, limit, orderBy, query, type DocumentData, type Firestore } from "firebase/firestore";
import { useFirestoreQuerySnapshot } from "./useFirestoreQuerySnapshot";

export const ORDERS_COLLECTION = "orders" as const;

export type RealtimeOrder = {
  id: string;
  status?: string;
  orderType?: string;
  tableNumber?: number;
  tableId?: string;
  paymentStatus?: string;
  totalAmount?: number;
  total?: number;
  customerName?: string;
  userId?: string;
  createdAt?: unknown;
  /** Full document for app-specific mapping. */
  raw: Record<string, unknown>;
};

function mapOrderDoc(id: string, data: DocumentData): RealtimeOrder {
  const r = data as Record<string, unknown>;
  const tableNumber =
    typeof r.tableNumber === "number" && Number.isFinite(r.tableNumber) ? r.tableNumber : undefined;
  const totalAmount =
    typeof r.totalAmount === "number"
      ? r.totalAmount
      : typeof r.total === "number"
        ? r.total
        : undefined;
  return {
    id,
    raw: r,
    status: typeof r.status === "string" ? r.status : undefined,
    orderType: typeof r.orderType === "string" ? r.orderType : undefined,
    tableNumber,
    tableId: typeof r.tableId === "string" ? r.tableId : undefined,
    paymentStatus: typeof r.paymentStatus === "string" ? r.paymentStatus : undefined,
    totalAmount,
    total: typeof r.total === "number" ? r.total : undefined,
    customerName: typeof r.customerName === "string" ? r.customerName : undefined,
    userId: typeof r.userId === "string" ? r.userId : undefined,
    createdAt: r.createdAt
  };
}

export type UseOrdersOptions = {
  enabled?: boolean;
  /** Max documents; default 50. Uses single-field `createdAt` ordering (no composite index). */
  pageSize?: number;
};

export type UseOrdersResult = {
  orders: RealtimeOrder[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};

/**
 * Realtime listener: newest `orders` first (`orderBy createdAt desc` + `limit`).
 */
export function useOrders(db: Firestore | null | undefined, options: UseOrdersOptions = {}): UseOrdersResult {
  const { enabled = true, pageSize = 50 } = options;

  const buildQuery = useCallback(
    (firestore: Firestore) =>
      query(collection(firestore, ORDERS_COLLECTION), orderBy("createdAt", "desc"), limit(pageSize)),
    [pageSize]
  );

  const { items, loading, error, refresh } = useFirestoreQuerySnapshot(db, buildQuery, mapOrderDoc, {
    enabled
  });

  return { orders: items, loading, error, refresh };
}
