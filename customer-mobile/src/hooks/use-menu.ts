import { useFirebaseMenu } from "@shared/hooks/useFirebaseMenu";
import { useMemo } from "react";
import { mapFirebaseProductToProduct } from "@/src/lib/menu-mapper";
import type { Product } from "@/src/lib/menu-data-types";
import { db } from "@/src/services/firebase";

export function useMenu() {
  const { products: rawProducts, categories, loading, error } = useFirebaseMenu(db);

  const products = useMemo<Product[]>(
    () => rawProducts.map(mapFirebaseProductToProduct),
    [rawProducts]
  );

  return { products, categories, loading, error };
}
