import { collection, doc, getDoc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { staffDb } from "../lib/firebase";
import { TABLES_COLLECTION, parseFloorTableDoc, type FloorTable, type TableStatus } from "../hooks/use-tables";

export { TABLES_COLLECTION };
export type { FloorTable, TableStatus };

/** @deprecated Same as {@link FloorTable} — `currentOrderId` is on the shared type now. */
export type FloorTableWithMeta = FloorTable;

/**
 * Real-time single `tables/{tableId}` document (onSnapshot).
 * Prefer {@link useTables} for the full collection when the screen needs the same stream as the floor.
 */
export function subscribeTableById(
  tableId: string,
  onNext: (table: FloorTable | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const id = tableId?.trim();
  if (!id) {
    onNext(null);
    return () => {};
  }
  const ref = doc(staffDb, TABLES_COLLECTION, id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      onNext(parseFloorTableDoc(snap.id, snap.data()));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

/**
 * Creates a new `tables/{id}` row (manager/admin per Firestore rules). For waiter testing, sign in as manager or seed data.
 */
export async function createFloorTableForTesting(nextTableNumber: number): Promise<string> {
  if (!Number.isFinite(nextTableNumber) || nextTableNumber < 1) {
    throw new Error("Invalid table number.");
  }
  const ref = doc(collection(staffDb, TABLES_COLLECTION));
  await setDoc(ref, {
    id: ref.id,
    tableNumber: nextTableNumber,
    status: "FREE"
  });
  return ref.id;
}

const DEMO_TABLE_IDS = ["table_1", "table_2", "table_3", "table_4", "table_5"] as const;

/**
 * Creates `tables/table_1` … `tables/table_5` with `tableNumber` 1–5 and `status: "FREE"` if the doc is missing.
 * Requires **manager** or **admin** (Firestore rules). Waiters should seed via Firebase Console or ask a manager to tap once.
 */
export async function seedFiveDemoTables(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const batch = writeBatch(staffDb);

  for (let i = 0; i < DEMO_TABLE_IDS.length; i++) {
    const id = DEMO_TABLE_IDS[i];
    const n = i + 1;
    const ref = doc(staffDb, TABLES_COLLECTION, id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      skipped++;
      continue;
    }
    batch.set(ref, {
      id,
      tableNumber: n,
      status: "FREE"
    });
    created++;
  }

  if (created > 0) {
    await batch.commit();
  }
  return { created, skipped };
}

export function formatSeedDemoTablesError(err: unknown): string {
  if (err instanceof FirebaseError && err.code === "permission-denied") {
    return (
      "Only manager or admin can create tables from the app. In Firebase Console → Firestore → collection `tables`, add documents " +
      "`table_1` … `table_5` each with fields: id (string), tableNumber (1–5), status \"FREE\"."
    );
  }
  if (err instanceof Error) return err.message;
  return "Could not seed tables.";
}
