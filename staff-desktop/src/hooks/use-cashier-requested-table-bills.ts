import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { collection, orderBy, query, where } from "firebase/firestore";
import { staffDb } from "@/lib/staff-db";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { ORDERS_COLLECTION } from "@/services/firestore-orders-core.js";

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

function isMissingIndexError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as { code?: unknown; message?: unknown };
  const code = typeof maybeErr.code === "string" ? maybeErr.code : "";
  const message = typeof maybeErr.message === "string" ? maybeErr.message.toLowerCase() : "";
  return code === "failed-precondition" && message.includes("requires an index");
}

/**
 * Realtime list of served table orders that are pending payment.
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

    const q = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("paymentStatus", "==", "pending"),
      where("status", "in", ["served", "SERVED"]),
      orderBy("createdAt", "desc")
    );

    const unsub = subscribeFirestoreQuery(
      "useCashierRequestedTableBills",
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
        if (isMissingIndexError(err)) {
          setLoading(true);
          setError(null);
          return;
        }
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load bill requests.");
      }
    );

    return () => unsub();
  }, [enabled]);

  return { bills, loading, error };
}
