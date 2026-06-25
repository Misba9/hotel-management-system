import { useEffect, useMemo, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { collection, limit, query, where } from "firebase/firestore";
import { isDineInOrderType, normalizeOrderStatus, normalizePaymentStatus } from "@shared/utils/canonical-order-fields";
import { DINE_IN_ORDER_TYPES } from "@shared/types/table";
import { staffDb } from "@/lib/staff-db";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { ORDERS_COLLECTION } from "@/services/firestore-orders-core.js";

const SNAPSHOT_LIMIT = 200;

export type CashierQueueLine = {
  name: string;
  price: number;
  quantity: number;
};

export type CashierQueueOrder = {
  id: string;
  tableNumber: number;
  tableName?: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  items: CashierQueueLine[];
  createdAt: Date | null;
};

function parseItems(raw: unknown): CashierQueueLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line: Record<string, unknown>) => ({
    name: String(line?.name ?? "Item"),
    price: Number(line?.price ?? line?.unitPrice ?? 0),
    quantity: Number(line?.quantity ?? line?.qty ?? 1)
  }));
}

function readCreatedAt(data: Record<string, unknown>): Date | null {
  const ts = data.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return null;
}

function mapDineInDoc(id: string, data: Record<string, unknown>): CashierQueueOrder | null {
  if (!isDineInOrderType(String(data.orderType ?? ""))) return null;
  const pay = normalizePaymentStatus(String(data.paymentStatus ?? ""));
  const st = normalizeOrderStatus(String(data.status ?? ""));
  if (pay === "paid" || st === "completed" || st === "cancelled") return null;
  const tn = data.tableNumber;
  const tableName = typeof data.tableName === "string" ? data.tableName : undefined;
  return {
    id,
    tableNumber: typeof tn === "number" ? tn : Number(tn) || 0,
    tableName,
    totalAmount: Number(data.totalAmount ?? data.total ?? 0),
    status: st,
    paymentStatus: pay,
    items: parseItems(data.items),
    createdAt: readCreatedAt(data)
  };
}

function mergeById(a: CashierQueueOrder[], b: CashierQueueOrder[]): CashierQueueOrder[] {
  const map = new Map<string, CashierQueueOrder>();
  for (const o of [...a, ...b]) map.set(o.id, o);
  return [...map.values()].sort((x, y) => (y.createdAt?.getTime() ?? 0) - (x.createdAt?.getTime() ?? 0));
}

export type UseCashierTablePaymentQueueResult = {
  orders: CashierQueueOrder[];
  loading: boolean;
  error: string | null;
};

/** Dine-in orders ready for payment: `status == ready` and `paymentStatus == pending`. */
export function useCashierTablePaymentQueue(enabled = true): UseCashierTablePaymentQueueResult {
  const [readyUnpaid, setReadyUnpaid] = useState<CashierQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setReadyUnpaid([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("orderType", "in", [...DINE_IN_ORDER_TYPES]),
      where("status", "==", "ready"),
      limit(SNAPSHOT_LIMIT)
    );

    const unsub = subscribeFirestoreQuery(
      "useCashierTablePaymentQueue",
      q,
      (snap) => {
        const list: CashierQueueOrder[] = [];
        snap.forEach((d) => {
          const row = mapDineInDoc(d.id, d.data() as Record<string, unknown>);
          if (row && row.paymentStatus === "pending") list.push(row);
        });
        list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setReadyUnpaid(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Could not load cashier queue.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [enabled]);

  const orders = useMemo(() => mergeById(readyUnpaid, []), [readyUnpaid]);

  return { orders, loading, error };
}
