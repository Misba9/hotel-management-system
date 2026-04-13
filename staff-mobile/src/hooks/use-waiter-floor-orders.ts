import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "../services/orders.js";
import { toTableOrderDisplayStatus } from "./use-table-active-orders";

const SNAPSHOT_LIMIT = 250;

/** Higher = more urgent for waiter (floor badge). */
const STATUS_PRIORITY: Record<string, number> = {
  READY: 40,
  PREPARING: 30,
  PLACED: 20,
  SERVED: 10
};

function isCompletedStatus(status: unknown): boolean {
  return String(status ?? "")
    .trim()
    .toUpperCase() === "COMPLETED";
}

function pickFloorStatus(candidates: string[]): string | null {
  let best: string | null = null;
  let score = -1;
  for (const raw of candidates) {
    const u = raw.trim().toUpperCase();
    const p = STATUS_PRIORITY[u] ?? 0;
    if (p > score) {
      score = p;
      best = u;
    }
  }
  return best;
}

export type UseWaiterFloorOrdersResult = {
  /** Highest-priority open ticket status per `tableNumber` (restaurant flow labels). */
  statusByTableNumber: Map<number, string>;
  loading: boolean;
  error: string | null;
};

/**
 * Single realtime listener: all `orderType == "table"` orders (bounded), grouped by `tableNumber`
 * for waiter floor tiles. Excludes COMPLETED.
 */
export function useWaiterFloorOrders(enabled = true): UseWaiterFloorOrdersResult {
  const [rawByTable, setRawByTable] = useState<Map<number, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRawByTable(new Map());
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("orderType", "==", "table"),
      limit(SNAPSHOT_LIMIT)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const bucket = new Map<number, string[]>();
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (isCompletedStatus(data.status)) return;
          const tn = data.tableNumber;
          if (typeof tn !== "number" || !Number.isFinite(tn)) return;
          const display = toTableOrderDisplayStatus(data.status);
          const list = bucket.get(tn) ?? [];
          list.push(display);
          bucket.set(tn, list);
        });
        setRawByTable(bucket);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setRawByTable(new Map());
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not sync floor orders.");
      }
    );

    return () => unsub();
  }, [enabled]);

  const statusByTableNumber = useMemo(() => {
    const out = new Map<number, string>();
    rawByTable.forEach((labels, tn) => {
      const best = pickFloorStatus(labels);
      if (best) out.set(tn, best);
    });
    return out;
  }, [rawByTable]);

  return { statusByTableNumber, loading, error };
}
