import { useEffect, useRef } from "react";
import { collection, doc, query, updateDoc, where } from "firebase/firestore";
import { normalizeOrderStatus } from "@shared/utils/canonical-order-fields";
import { DINE_IN_ORDER_TYPES } from "@shared/types/table";
import { staffDb } from "../lib/firebase";
import { subscribeFirestoreQuery } from "../lib/firestore-listener";
import { requireFirestoreId } from "../lib/firestore-path";
import { logWarn } from "../lib/error-logging";
import { ORDERS_COLLECTION } from "../services/orders.js";
import { TABLES_COLLECTION } from "./use-tables";

function isTerminalOrderStatus(status: unknown): boolean {
  const canon = normalizeOrderStatus(String(status ?? ""));
  return canon === "completed" || canon === "cancelled";
}

/** Realtime dine-in orders → sync `tables/{tableId}.status`. */
export function useTableOrderTableSync(enabled: boolean) {
  const lastDesiredOccupiedRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!enabled) {
      lastDesiredOccupiedRef.current = new Map();
      return undefined;
    }

    const q = query(
      collection(staffDb, ORDERS_COLLECTION),
      where("orderType", "in", [...DINE_IN_ORDER_TYPES])
    );

    const unsub = subscribeFirestoreQuery(
      "useTableOrderTableSync",
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
          const status = occupied ? "occupied" : "available";
          const tid = requireFirestoreId(tableId, "tableId");
          if (!tid) continue;
          void updateDoc(doc(staffDb, TABLES_COLLECTION, tid), { status }).catch((err) => {
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
