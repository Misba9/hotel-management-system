import { useCallback, useMemo } from "react";
import { collection, type DocumentData, type Firestore } from "firebase/firestore";
import { useFirestoreQuerySnapshot } from "./useFirestoreQuerySnapshot";

export const TABLES_COLLECTION = "tables" as const;

export type TableStatus = "free" | "occupied";

export type FloorTable = {
  id: string;
  number: number;
  status: TableStatus;
};

function parseStatus(data: Record<string, unknown>): TableStatus {
  if (typeof data.status === "string") {
    const s = data.status.trim().toUpperCase();
    if (s === "OCCUPIED") return "occupied";
    if (s === "FREE") return "free";
    const lower = s.toLowerCase();
    if (lower === "occupied") return "occupied";
    if (lower === "free") return "free";
  }
  if (data.isOccupied === true) return "occupied";
  return "free";
}

function parseTableDoc(id: string, data: DocumentData): FloorTable {
  const r = data as Record<string, unknown>;
  let number =
    typeof r.tableNumber === "number" && Number.isFinite(r.tableNumber)
      ? r.tableNumber
      : typeof r.number === "number" && Number.isFinite(r.number)
        ? r.number
        : NaN;
  if (!Number.isFinite(number)) {
    const n = parseInt(String(r.name ?? "").replace(/\D/g, ""), 10);
    number = Number.isFinite(n) ? n : NaN;
  }
  if (!Number.isFinite(number)) {
    const fromId = parseInt(id.replace(/\D/g, ""), 10);
    number = Number.isFinite(fromId) ? fromId : 0;
  }
  return { id, number, status: parseStatus(r) };
}

function sortTables(rows: FloorTable[]): FloorTable[] {
  return [...rows].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
}

export type UseTablesOptions = {
  enabled?: boolean;
};

export type UseTablesResult = {
  tables: FloorTable[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};

/**
 * Realtime listener for the full `tables` collection.
 */
export function useTables(db: Firestore | null | undefined, options: UseTablesOptions = {}): UseTablesResult {
  const { enabled = true } = options;

  const buildQuery = useCallback((firestore: Firestore) => collection(firestore, TABLES_COLLECTION), []);

  const { items, loading, error, refresh } = useFirestoreQuerySnapshot(
    db,
    buildQuery,
    parseTableDoc,
    { enabled }
  );

  const tables = useMemo(() => sortTables(items), [items]);

  return { tables, loading, error, refresh };
}
