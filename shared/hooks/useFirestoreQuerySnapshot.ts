import { useCallback, useEffect, useState } from "react";
import { onSnapshot, type DocumentData, type Firestore, type Query } from "firebase/firestore";

export type UseFirestoreQuerySnapshotOptions = {
  /** When false, clears data and stops listening. Default true. */
  enabled?: boolean;
};

export type UseFirestoreQuerySnapshotResult<T> = {
  items: T[];
  loading: boolean;
  error: Error | null;
  /** Re-subscribe (e.g. pull-to-refresh). */
  refresh: () => void;
};

/**
 * Subscribes to a Firestore {@link Query} with {@link onSnapshot}.
 * Pass a stable {@link buildQuery} (e.g. from `useCallback`) and a {@link mapDoc} mapper.
 */
export function useFirestoreQuerySnapshot<T>(
  db: Firestore | null | undefined,
  buildQuery: (db: Firestore) => Query,
  mapDoc: (id: string, data: DocumentData) => T,
  options: UseFirestoreQuerySnapshotOptions = {}
): UseFirestoreQuerySnapshotResult<T> {
  const enabled = options.enabled !== false && db != null;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || db == null) {
      setItems([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = buildQuery(db);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: T[] = [];
        snap.forEach((d) => next.push(mapDoc(d.id, d.data())));
        setItems(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setItems([]);
        setLoading(false);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    return () => unsub();
  }, [db, enabled, nonce, buildQuery]);

  return { items, loading, error, refresh };
}
