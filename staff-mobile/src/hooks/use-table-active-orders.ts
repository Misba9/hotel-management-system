import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "../services/orders.js";

export type TableActiveOrderLine = {
  name: string;
  price: number;
  quantity: number;
};

export type TableActiveOrder = {
  id: string;
  statusRaw: string;
  displayStatus: string;
  paymentStatus: string;
  orderType: string;
  items: TableActiveOrderLine[];
  totalAmount: number;
  createdAt: Date | null;
};

function isCompletedStatus(status: unknown): boolean {
  return String(status ?? "")
    .trim()
    .toUpperCase() === "COMPLETED";
}

/** Maps Firestore status to waiter-facing kitchen / floor labels. */
export function toTableOrderDisplayStatus(
  status: unknown
): "PLACED" | "PREPARING" | "READY" | "SERVED" | string {
  const s = String(status ?? "")
    .trim()
    .toUpperCase();
  if (["PLACED", "PENDING", "CREATED", "CONFIRMED"].includes(s)) return "PLACED";
  if (["PREPARING", "ACCEPTED"].includes(s)) return "PREPARING";
  if (s === "READY") return "READY";
  if (s === "SERVED") return "SERVED";
  return s || "PLACED";
}

function parseItems(raw: unknown): TableActiveOrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line: Record<string, unknown>) => ({
    name: String(line?.name ?? "Item"),
    price: Number(line?.price ?? 0),
    quantity: Number(line?.quantity ?? line?.qty ?? 1)
  }));
}

function readCreatedAt(data: Record<string, unknown>): Date | null {
  const ts = data.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return null;
}

export type UseTableActiveOrdersResult = {
  orders: TableActiveOrder[];
  loading: boolean;
  error: string | null;
};

/**
 * Realtime: `orders` collection query (`tableNumber` equality) via `onSnapshot`, excluding `COMPLETED`.
 * Client filter avoids a composite index for status inequality; enable while the table row exists so FREE→OCCUPIED updates apply immediately.
 */
export function useTableActiveOrders(tableNumber: number, enabled: boolean): UseTableActiveOrdersResult {
  const [orders, setOrders] = useState<TableActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !Number.isFinite(tableNumber)) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(staffDb, ORDERS_COLLECTION), where("tableNumber", "==", tableNumber));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TableActiveOrder[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (isCompletedStatus(data.status)) return;
          const statusRaw = String(data.status ?? "");
          list.push({
            id: d.id,
            statusRaw,
            displayStatus: toTableOrderDisplayStatus(data.status),
            paymentStatus: String(data.paymentStatus ?? "").trim(),
            orderType: String(data.orderType ?? "").trim(),
            items: parseItems(data.items),
            totalAmount: Number(data.totalAmount ?? data.total ?? 0),
            createdAt: readCreatedAt(data)
          });
        });
        list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setOrders(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setOrders([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load orders.");
      }
    );

    return () => unsub();
  }, [tableNumber, enabled]);

  return { orders, loading, error };
}
