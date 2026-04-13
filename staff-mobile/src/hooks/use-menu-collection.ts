import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { staffDb } from "../lib/firebase";

/** Firestore collection for waiter table-order menu (distinct from `menu_items` if you use both). */
export const MENU_COLLECTION = "menu" as const;

export type MenuDocumentItem = {
  id: string;
  name: string;
  price: number;
};

function normalizeMenuDoc(id: string, raw: Record<string, unknown>): MenuDocumentItem | null {
  const available = raw.available !== false && raw.isAvailable !== false;
  if (!available) return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const price = Number(raw.price ?? 0);
  if (!Number.isFinite(price) || price < 0) return null;
  return { id, name, price };
}

export type UseMenuCollectionResult = {
  items: MenuDocumentItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Real-time items from `menu/{docId}`.
 * Expected fields: `name` (string), `price` (number), optional `available` / `isAvailable` (default true).
 */
export function useMenuCollection(enabled = true): UseMenuCollectionResult {
  const [items, setItems] = useState<MenuDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listenerKey, setListenerKey] = useState(0);

  const refresh = useCallback(() => {
    setListenerKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const col = collection(staffDb, MENU_COLLECTION);
    const unsub = onSnapshot(
      col,
      (snap) => {
        const list: MenuDocumentItem[] = [];
        snap.forEach((docSnap) => {
          const row = normalizeMenuDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
          if (row) list.push(row);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setItems(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setItems([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load menu.");
      }
    );

    return () => unsub();
  }, [enabled, listenerKey]);

  return { items, loading, error, refresh };
}
