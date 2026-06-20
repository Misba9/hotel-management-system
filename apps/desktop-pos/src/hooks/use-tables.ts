import { useCallback, useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import {
  TABLES_COLLECTION,
  parseFloorTableDoc,
  type FloorTable,
  type TableStatus
} from "@shared/hooks/useTables";
import { getStaffDb } from "@/lib/firebase";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";

export type { FloorTable, TableStatus };
export { TABLES_COLLECTION, parseFloorTableDoc };

export type UseTablesResult = {
  tables: FloorTable[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};

export function useTables(enabled = true): UseTablesResult {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setTables([]);
      setLoading(false);
      setError(null);
      return undefined;
    }
    const db = getStaffDb();
    if (!db) {
      setTables([]);
      setLoading(false);
      setError(new Error("Firestore is not initialized."));
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeFirestoreQuery(
      "useTables",
      collection(db, TABLES_COLLECTION),
      (snap) => {
        const rows = snap.docs.map((d) => parseFloorTableDoc(d.id, d.data()));
        rows.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
        setTables(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setTables([]);
        setLoading(false);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    return () => unsub();
  }, [enabled, nonce]);

  return { tables, loading, error, refresh };
}
