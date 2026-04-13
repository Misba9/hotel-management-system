/**
 * Firestore order subscriptions and mapping for the customer app.
 *
 * **Collection:** `orders` (canonical). Documents use `userId` (Firebase Auth UID) for
 * customer-scoped queries — keep aligned with `persistStorefrontOrder` / staff `orders.js`.
 *
 * **Index:** `userId` ASC + `createdAt` DESC — see `backend/firestore.indexes.json`.
 * Use bounded `limit` and cursor pagination for history.
 */
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { summarizeOrderItems } from "@shared/utils/order-items-summary";
import { firestoreTimeToIso } from "@/lib/order-tracking";

export type CustomerOrderListItem = {
  id: string;
  trackingId?: string;
  trackingToken?: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  itemsSummary: string;
  paymentMethod?: string;
  paymentStatus?: string;
};

export function mapOrderDocToListItem(doc: QueryDocumentSnapshot): CustomerOrderListItem {
  const data = doc.data() as Record<string, unknown>;
  const itemsSummary = summarizeOrderItems(data.items);
  return {
    id: doc.id,
    trackingId: typeof data.trackingId === "string" ? data.trackingId : doc.id,
    trackingToken: typeof data.trackingToken === "string" ? data.trackingToken : undefined,
    amount: Number(data.totalAmount ?? data.total ?? 0) || 0,
    status: typeof data.status === "string" && data.status.trim() ? data.status.trim() : "pending",
    createdAt: firestoreTimeToIso(data.createdAt),
    address: typeof data.address === "string" ? data.address : undefined,
    itemsSummary: itemsSummary || "—",
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : undefined,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined
  };
}

/** Default window for live listener (keeps reads + sync payload small at scale). */
export const USER_ORDERS_LIVE_LIMIT = 25;

export type SubscribeUserOrdersOptions = {
  /** Max docs for the realtime window (default {@link USER_ORDERS_LIVE_LIMIT}). */
  maxDocs?: number;
  onData: (orders: CustomerOrderListItem[]) => void;
  /** Last document in this snapshot window (for `startAfter` pagination). */
  onMeta?: (lastVisible: QueryDocumentSnapshot | null) => void;
  onError?: (message: string) => void;
};

function userOrdersQuery(db: Firestore, userId: string, maxDocs: number) {
  return query(
    collection(db, "orders"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxDocs)
  );
}

/**
 * Real-time listener: newest orders for the user only (bounded by `maxDocs`).
 */
export function subscribeToUserOrders(
  db: Firestore,
  userId: string,
  options: SubscribeUserOrdersOptions
): Unsubscribe {
  const maxDocs = options.maxDocs ?? USER_ORDERS_LIVE_LIMIT;
  const q = userOrdersQuery(db, userId, maxDocs);

  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map(mapOrderDocToListItem);
      const lastVisible = snap.docs[snap.docs.length - 1] ?? null;
      options.onData(orders);
      options.onMeta?.(lastVisible);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("nausheen_orders_cache", JSON.stringify(orders));
        } catch {
          /* ignore quota */
        }
      }
    },
    (err) => {
      console.error("[subscribeToUserOrders]", err);
      options.onError?.("Could not load orders. Check your connection and try again.");
    }
  );
}

export type FetchUserOrdersPageResult = {
  items: CustomerOrderListItem[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

/**
 * One page of older orders (cursor pagination). Same indexed query as the live listener.
 */
export async function fetchUserOrdersPage(
  db: Firestore,
  userId: string,
  pageSize: number,
  cursor: QueryDocumentSnapshot | null
): Promise<FetchUserOrdersPageResult> {
  const col = collection(db, "orders");
  const q = cursor
    ? query(col, where("userId", "==", userId), orderBy("createdAt", "desc"), startAfter(cursor), limit(pageSize))
    : query(col, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  const items = snap.docs.map(mapOrderDocToListItem);
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  const hasMore = snap.docs.length === pageSize;
  return { items, lastDoc, hasMore };
}
