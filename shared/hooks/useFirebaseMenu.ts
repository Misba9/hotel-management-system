import { useEffect, useMemo, useState } from "react";
import type { Firestore } from "firebase/firestore";
import {
  buildMenuCategories,
  subscribeFirebaseMenu,
  type FirebaseMenuCategory,
  type FirebaseMenuProduct
} from "../lib/firebase-menu";

export type UseFirebaseMenuResult = {
  products: FirebaseMenuProduct[];
  categories: FirebaseMenuCategory[];
  loading: boolean;
  error: string | null;
};

/**
 * Live menu from Firestore `products` + `categories`.
 * Used by Desktop POS and Staff Web — admin changes appear within ~1–2s.
 */
export function useFirebaseMenu(db: Firestore | null | undefined, enabled = true): UseFirebaseMenuResult {
  const [products, setProducts] = useState<FirebaseMenuProduct[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled && db));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      setError(null);
      return undefined;
    }

    if (!db) {
      setProducts([]);
      setLoading(false);
      setError("Firestore is not initialized.");
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeFirebaseMenu(
      db,
      (list) => {
        setProducts(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setProducts([]);
        setLoading(false);
        setError(err.message);
      }
    );

    return unsub;
  }, [db, enabled]);

  const categories = useMemo(() => buildMenuCategories(products), [products]);

  return { products, categories, loading, error };
}
