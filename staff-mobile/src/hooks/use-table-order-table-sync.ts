import { useEffect, useRef } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { logWarn } from "../lib/error-logging";
import { ORDERS_COLLECTION } from "../services/orders.js";
import { TABLES_COLLECTION } from "./use-tables";

/** Order statuses that mean the table can be marked FREE (case-insensitive). */
const TERMINAL_ORDER_STATUSES = new Set([
  "delivered",
  "cancelled",
  "canceled",
  "rejected",
  "completed",
  "closed",
  "void",
  "done"
]);

function isTerminalOrderStatus(status: unknown): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return TERMINAL_ORDER_STATUSES.has(s);
}

/**
 * Realtime: `onSnapshot` on `orders` where `orderType == "table"`.
 * When any open (non-terminal) order exists for `tableId`, sets `tables/{tableId}.status` to OCCUPIED;
 * when all orders for that table are terminal (or no open orders remain), sets FREE.
 * Works with {@link useTables} so the dashboard updates as `tables` documents change.
 */
export function useTableOrderTableSync(enabled: boolean) {
  const lastDesiredOccupiedRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!enabled) {
      lastDesiredOccupiedRef.current = new Map();
      return undefined;
    }

    const q = query(collection(staffDb, ORDERS_COLLECTION), where("orderType", "==", "table"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const hasOpenOrder = new Map<string, boolean>();

        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
          if (!tableId) return;
          const open = !isTerminalOrderStatus(data.status);
          const prev = hasOpenOrder.get(tableId) ?? false;
          hasOpenOrder.set(tableId, prev || open);
        });

        const candidateIds = new Set([
          ...hasOpenOrder.keys(),
          ...lastDesiredOccupiedRef.current.keys()
        ]);

        for (const tableId of candidateIds) {
          const occupied = hasOpenOrder.get(tableId) ?? false;
          const last = lastDesiredOccupiedRef.current.get(tableId);
          if (last === occupied) continue;
          lastDesiredOccupiedRef.current.set(tableId, occupied);
          const status = occupied ? "OCCUPIED" : "FREE";
          void updateDoc(doc(staffDb, TABLES_COLLECTION, tableId), { status }).catch((err) => {
            logWarn(
              "useTableOrderTableSync.update",
              err instanceof Error ? err.message : String(err),
              err
            );
          });
        }
      },
      (err) => {
        logWarn("useTableOrderTableSync.listener", err instanceof Error ? err.message : String(err), err);
      }
    );

    return () => unsub();
  }, [enabled]);
}
