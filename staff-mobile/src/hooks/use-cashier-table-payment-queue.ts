import { useEffect, useMemo, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "../services/orders.js";

const SNAPSHOT_LIMIT = 200;

export type CashierQueueLine = {
  name: string;
  price: number;
  quantity: number;
};

export type CashierQueueOrder = {
  id: string;
  tableNumber: number;
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
    price: Number(line?.price ?? 0),
    quantity: Number(line?.quantity ?? line?.qty ?? 1)
  }));
}

function readCreatedAt(data: Record<string, unknown>): Date | null {
  const ts = data.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  return null;
}

function mapTableDoc(id: string, data: Record<string, unknown>): CashierQueueOrder | null {
  if (String(data.orderType ?? "").toLowerCase() !== "table") return null;
  const pay = String(data.paymentStatus ?? "").toUpperCase();
  const st = String(data.status ?? "").toUpperCase();
  if (pay === "PAID" || st === "COMPLETED") return null;
  return {
    id,
    tableNumber: Number(data.tableNumber ?? 0),
    totalAmount: Number(data.totalAmount ?? data.total ?? 0),
    status: String(data.status ?? ""),
    paymentStatus: String(data.paymentStatus ?? "").trim(),
    items: parseItems(data.items),
    createdAt: readCreatedAt(data)
  };
}

function mergeById(
  requested: CashierQueueOrder[],
  served: CashierQueueOrder[]
): CashierQueueOrder[] {
  const map = new Map<string, CashierQueueOrder>();
  for (const o of served) map.set(o.id, o);
  for (const o of requested) map.set(o.id, o);
  return [...map.values()].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export type UseCashierTablePaymentQueueResult = {
  orders: CashierQueueOrder[];
  loading: boolean;
  error: string | null;
};

/**
 * Cashier queue: table orders where `paymentStatus == REQUESTED` **or** `status == SERVED`
 * (still unpaid). Two `onSnapshot` listeners merged by order id.
 */
export function useCashierTablePaymentQueue(enabled = true): UseCashierTablePaymentQueueResult {
  const [requested, setRequested] = useState<CashierQueueOrder[]>([]);
  const [served, setServed] = useState<CashierQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRequested([]);
      setServed([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    let reqReady = false;
    let srvReady = false;

    const tryDone = () => {
      if (reqReady && srvReady) setLoading(false);
    };

    const onErr = (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load cashier queue.");
      setLoading(false);
    };

    const qReq = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("paymentStatus", "==", "REQUESTED"),
      limit(SNAPSHOT_LIMIT)
    );
    const qSrv = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("status", "==", "SERVED"),
      limit(SNAPSHOT_LIMIT)
    );

    const unsubReq = onSnapshot(
      qReq,
      (snap) => {
        const list: CashierQueueOrder[] = [];
        snap.forEach((d) => {
          const row = mapTableDoc(d.id, d.data() as Record<string, unknown>);
          if (row) list.push(row);
        });
        list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setRequested(list);
        reqReady = true;
        tryDone();
        setError(null);
      },
      onErr
    );

    const unsubSrv = onSnapshot(
      qSrv,
      (snap) => {
        const list: CashierQueueOrder[] = [];
        snap.forEach((d) => {
          const row = mapTableDoc(d.id, d.data() as Record<string, unknown>);
          if (row) list.push(row);
        });
        list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setServed(list);
        srvReady = true;
        tryDone();
        setError(null);
      },
      onErr
    );

    return () => {
      unsubReq();
      unsubSrv();
    };
  }, [enabled]);

  const orders = useMemo(() => mergeById(requested, served), [requested, served]);

  return { orders, loading, error };
}
