import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "../services/orders.js";
import { toTableOrderDisplayStatus, type TableActiveOrderLine } from "./use-table-active-orders";

export type TableOrderLive = {
  id: string;
  statusRaw: string;
  displayStatus: string;
  paymentStatus: string;
  orderType: string;
  /** Firestore `tables/{id}` when present (table service tickets). */
  tableId: string;
  tableNumber: number;
  items: TableActiveOrderLine[];
  totalAmount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function parseItems(raw: unknown): TableActiveOrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line: Record<string, unknown>) => ({
    name: String(line?.name ?? "Item"),
    price: Number(line?.price ?? 0),
    quantity: Number(line?.quantity ?? line?.qty ?? 1)
  }));
}

function readTs(data: Record<string, unknown>, key: "createdAt" | "updatedAt"): Date | null {
  const ts = data[key] as Timestamp | undefined;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return null;
}

export type UseTableOrderLiveResult = {
  order: TableOrderLive | null;
  loading: boolean;
  error: string | null;
};

/**
 * Real-time single `orders/{orderId}` document for waiter order detail (status / payment updates).
 */
export function useTableOrderLive(orderId: string | null | undefined, enabled: boolean): UseTableOrderLiveResult {
  const [order, setOrder] = useState<TableOrderLive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = orderId?.trim();
    if (!enabled || !id) {
      setOrder(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const ref = doc(staffDb, ORDERS_COLLECTION, id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOrder(null);
          setLoading(false);
          setError(null);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const statusRaw = String(data.status ?? "");
        setOrder({
          id: snap.id,
          statusRaw,
          displayStatus: toTableOrderDisplayStatus(data.status),
          paymentStatus: String(data.paymentStatus ?? "").trim(),
          orderType: String(data.orderType ?? "").trim(),
          tableId: typeof data.tableId === "string" ? data.tableId : "",
          tableNumber: Number(data.tableNumber ?? 0),
          items: parseItems(data.items),
          totalAmount: Number(data.totalAmount ?? data.total ?? 0),
          createdAt: readTs(data, "createdAt"),
          updatedAt: readTs(data, "updatedAt")
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setOrder(null);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load order.");
      }
    );

    return () => unsub();
  }, [orderId, enabled]);

  return { order, loading, error };
}
