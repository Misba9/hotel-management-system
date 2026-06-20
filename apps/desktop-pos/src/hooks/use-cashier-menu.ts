import { useEffect, useMemo, useState } from "react";
import {
  groupProductsByCategory,
  subscribeMenuProducts,
  type MenuProduct
} from "@/services/products";
import type { MenuItemDoc } from "@/components/pos/pos-types";
import { getStaffDb } from "@/lib/firebase";

function toMenuItemDoc(p: MenuProduct): MenuItemDoc {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    image: p.image,
    available: p.availability
  };
}

export function useCashierMenu(enabled = true) {
  const [products, setProducts] = useState<MenuItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    const db = getStaffDb();
    if (!db) {
      setProducts([]);
      setLoading(false);
      setError("Firestore is not initialized.");
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeMenuProducts(
      (list) => {
        setProducts(list.map(toMenuItemDoc));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setProducts([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load menu.");
      }
    );
    return unsub;
  }, [enabled]);

  const grouped = useMemo(() => {
    const asProducts: MenuProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category ?? "Other",
      image: p.image ?? "",
      availability: p.available !== false
    }));
    return groupProductsByCategory(asProducts);
  }, [products]);

  const categories = useMemo(() => ["all", ...Object.keys(grouped).sort()], [grouped]);

  return { products, grouped, categories, loading, error };
}
