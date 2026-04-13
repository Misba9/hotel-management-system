import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "../services/orders.js";

export type RequestedTableBill = {
  id: string;
  tableNumber: number;
  totalAmount: number;
  status: string;
};

function readCreatedAtMs(data: Record<string, unknown>): number {
  const ts = data.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

/**
 * Realtime list of `orderType == "table"` orders with `paymentStatus == "REQUESTED"` (waiter asked for bill).
 */
export function useCashierRequestedTableBills(enabled: boolean) {
  const [bills, setBills] = useState<RequestedTableBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBills([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(staffDb, ORDERS_COLLECTION), where("paymentStatus", "==", "REQUESTED"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw: Array<RequestedTableBill & { _ms: number }> = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (String(data.orderType ?? "") !== "table") return;
          raw.push({
            id: d.id,
            tableNumber: Number(data.tableNumber ?? 0),
            totalAmount: Number(data.totalAmount ?? data.total ?? 0),
            status: String(data.status ?? ""),
            _ms: readCreatedAtMs(data)
          });
        });
        raw.sort((a, b) => b._ms - a._ms);
        setBills(raw.map(({ _ms, ...row }) => row));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setBills([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load bill requests.");
      }
    );

    return () => unsub();
  }, [enabled]);

  return { bills, loading, error };
}
