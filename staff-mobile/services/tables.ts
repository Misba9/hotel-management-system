import { collection, doc, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";

import { staffDb } from "../src/lib/firebase";
import { TABLES_COLLECTION, parseFloorTableDoc, type FloorTable } from "../src/hooks/use-tables";

export type { FloorTable };

export function subscribeAllTables(
  onNext: (tables: FloorTable[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(staffDb, TABLES_COLLECTION),
    (snap) => {
      const rows = snap.docs.map((d) => parseFloorTableDoc(d.id, d.data()));
      rows.sort(
        (a, b) =>
          (a.number ?? 0) - (b.number ?? 0) ||
          (a.displayName ?? "").localeCompare(b.displayName ?? "") ||
          a.id.localeCompare(b.id)
      );
      onNext(rows);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

export async function patchWaiterTable(
  tableId: string,
  patch: { status: "FREE" | "OCCUPIED" | "available" | "occupied"; currentOrderId?: string | null }
): Promise<void> {
  const ref = doc(staffDb, TABLES_COLLECTION, tableId);
  const occupied = patch.status === "OCCUPIED" || patch.status === "occupied";
  const status = occupied ? "occupied" : "available";
  /** Waiter rule allows only `status` + `currentOrderId` — do not add other fields. */
  await updateDoc(ref, {
    status,
    ...(patch.currentOrderId !== undefined ? { currentOrderId: patch.currentOrderId } : {})
  });
}
