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
      rows.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      onNext(rows);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

export async function patchWaiterTable(
  tableId: string,
  patch: { status: "FREE" | "OCCUPIED"; currentOrderId?: string | null }
): Promise<void> {
  const ref = doc(staffDb, TABLES_COLLECTION, tableId);
  /** Waiter rule allows only `status` + `currentOrderId` — do not add other fields. */
  await updateDoc(ref, {
    status: patch.status,
    ...(patch.currentOrderId !== undefined ? { currentOrderId: patch.currentOrderId } : {})
  });
}
