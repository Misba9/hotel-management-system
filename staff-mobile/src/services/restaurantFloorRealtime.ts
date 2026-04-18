import type { Firestore } from "firebase/firestore";
import {
  collection,
  limit as limitFn,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe
} from "firebase/firestore";
import { normalizeOrderDocToFloorShape } from "@shared/utils/restaurant-floor-normalize";
import type { RestaurantTableDoc, TableServiceOrderDoc } from "@shared/types/restaurant-floor-collections";
import {
  RESTAURANT_ORDERS_COLLECTION,
  RESTAURANT_TABLES_COLLECTION
} from "@shared/types/restaurant-floor-collections";

export type { RestaurantTableDoc, TableServiceOrderDoc };
export { RESTAURANT_TABLES_COLLECTION, RESTAURANT_ORDERS_COLLECTION };

function parseTableDoc(id: string, data: Record<string, unknown>): RestaurantTableDoc & { id: string } {
  const s = typeof data.status === "string" ? data.status.trim().toUpperCase() : "";
  const status: RestaurantTableDoc["status"] = s === "OCCUPIED" ? "OCCUPIED" : "FREE";
  const tableNumber =
    typeof data.tableNumber === "number" && Number.isFinite(data.tableNumber)
      ? data.tableNumber
      : typeof data.number === "number" && Number.isFinite(data.number)
        ? data.number
        : NaN;
  const num = Number.isFinite(tableNumber) ? tableNumber : parseInt(id.replace(/\D/g, ""), 10) || 0;
  const currentOrderId =
    typeof data.currentOrderId === "string"
      ? data.currentOrderId
      : data.currentOrderId === null
        ? null
        : undefined;
  return {
    id,
    tableNumber: num,
    status,
    ...(currentOrderId !== undefined ? { currentOrderId } : {})
  };
}

/**
 * Realtime: entire `tables` collection (small floor plans only — avoid huge datasets).
 */
export function subscribeTablesRealtime(
  db: Firestore,
  onNext: (tables: Array<RestaurantTableDoc & { id: string }>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = collection(db, RESTAURANT_TABLES_COLLECTION);
  return onSnapshot(
    ref,
    (snap) => {
      const list = snap.docs.map((d) => parseTableDoc(d.id, d.data() as Record<string, unknown>));
      list.sort((a, b) => a.tableNumber - b.tableNumber || a.id.localeCompare(b.id));
      onNext(list);
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );
}

export type SubscribeOrdersRealtimeOptions = {
  /** Max rows (newest first). Default 500. */
  maxRows?: number;
};

/**
 * Realtime: recent `orders` documents (bounded query). Maps each doc to {@link TableServiceOrderDoc} via
 * {@link normalizeOrderDocToFloorShape} (`total`, `qty`).
 */
export function subscribeOrdersRealtime(
  db: Firestore,
  onNext: (orders: TableServiceOrderDoc[]) => void,
  onError?: (err: Error) => void,
  options: SubscribeOrdersRealtimeOptions = {}
): Unsubscribe {
  const maxRows = options.maxRows ?? 500;
  const q = query(collection(db, RESTAURANT_ORDERS_COLLECTION), orderBy("createdAt", "desc"), limitFn(maxRows));
  return onSnapshot(
    q,
    (snap) => {
      const list: TableServiceOrderDoc[] = [];
      for (const d of snap.docs) {
        const n = normalizeOrderDocToFloorShape(d.id, d.data());
        if (n) list.push(n);
      }
      onNext(list);
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );
}
