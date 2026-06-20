import { useCallback, useEffect, useMemo, useState } from "react";
import { useCashierMenu } from "@/hooks/use-cashier-menu";
import type { MenuItemDoc } from "@/components/pos/pos-types";

type SqliteProduct = {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string | null;
};

/** Firestore menu when online; SQLite seed catalog as offline fallback. */
export function usePosMenu(syncOnline: boolean) {
  const firestoreMenu = useCashierMenu(syncOnline);
  const [sqliteProducts, setSqliteProducts] = useState<MenuItemDoc[]>([]);
  const [sqliteLoading, setSqliteLoading] = useState(true);

  const loadSqlite = useCallback(async () => {
    if (!window.posApi) {
      setSqliteProducts([]);
      setSqliteLoading(false);
      return;
    }
    try {
      const rows = await window.posApi.getProducts();
      setSqliteProducts(
        rows.map((p: SqliteProduct) => ({
          id: String(p.id),
          name: p.name,
          price: p.price,
          category: p.category,
          image: p.image,
          available: true
        }))
      );
    } catch {
      setSqliteProducts([]);
    } finally {
      setSqliteLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSqlite();
  }, [loadSqlite]);

  const useFirestore = syncOnline && firestoreMenu.products.length > 0 && !firestoreMenu.error;

  const products = useMemo(
    () => (useFirestore ? firestoreMenu.products : sqliteProducts),
    [useFirestore, firestoreMenu.products, sqliteProducts]
  );

  const grouped = useMemo(() => {
    const map: Record<string, MenuItemDoc[]> = {};
    for (const p of products) {
      if (p.available === false) continue;
      const key = p.category ?? "Other";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [products]);

  const categories = useMemo(() => ["all", ...Object.keys(grouped).sort()], [grouped]);

  return {
    products,
    grouped,
    categories,
    loading: useFirestore ? firestoreMenu.loading : sqliteLoading,
    error: useFirestore ? firestoreMenu.error : null,
    source: useFirestore ? ("firestore" as const) : ("sqlite" as const)
  };
}
