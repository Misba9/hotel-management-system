import { collection, onSnapshot, type Firestore, type Unsubscribe } from "firebase/firestore";

export const PRODUCTS_COLLECTION = "products";
export const CATEGORIES_COLLECTION = "categories";

export type FirebaseMenuProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  inStock: boolean;
};

export type FirebaseMenuCategory = {
  id: string;
  name: string;
  count: number;
};

function slugCategory(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function mapProductDoc(
  id: string,
  data: Record<string, unknown>,
  categoryNameById: Map<string, string>
): FirebaseMenuProduct | null {
  const name = typeof data.name === "string" ? data.name : "";
  if (!name.trim()) return null;
  const price =
    typeof data.price === "number" && Number.isFinite(data.price) ? data.price : Number(data.price) || 0;
  const categoryId =
    typeof data.categoryId === "string" && data.categoryId.trim() ? data.categoryId.trim() : "";
  const categoryFromField =
    typeof data.category === "string" && data.category.trim() ? data.category.trim() : "";
  const fromMap = categoryId ? categoryNameById.get(categoryId)?.trim() : "";
  let category = "Other";
  if (fromMap) category = fromMap;
  else if (categoryFromField) category = categoryFromField;
  else if (categoryId) category = categoryId;
  const image =
    typeof data.image === "string"
      ? data.image
      : typeof data.imageUrl === "string"
        ? data.imageUrl
        : "";
  const inStock =
    data.available !== false && data.availability !== false && data.isAvailable !== false;
  return {
    id: typeof data.id === "string" && data.id ? data.id : id,
    name: name.trim(),
    price: Math.max(0, price),
    category: category || "Other",
    image,
    inStock
  };
}

/** Build sidebar categories with counts from live product list. */
export function buildMenuCategories(products: FirebaseMenuProduct[]): FirebaseMenuCategory[] {
  const available = products.filter((p) => p.inStock);
  const counts = new Map<string, number>();
  for (const p of available) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return [
    { id: "all", name: "All Items", count: available.length },
    ...Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ id: slugCategory(name), name, count }))
  ];
}

/**
 * Real-time Firestore menu — `categories` + `products` collections (same as admin / staff-mobile).
 */
export function subscribeFirebaseMenu(
  db: Firestore,
  onNext: (products: FirebaseMenuProduct[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let categoryNameById = new Map<string, string>();
  let productDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  let catReady = false;
  let prodReady = false;

  const emit = () => {
    if (!catReady || !prodReady) return;
    const list: FirebaseMenuProduct[] = [];
    for (const { id, data } of productDocs) {
      const row = mapProductDoc(id, data, categoryNameById);
      if (row) list.push(row);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    onNext(list);
  };

  const unsubCat = onSnapshot(
    collection(db, CATEGORIES_COLLECTION),
    (snap) => {
      const m = new Map<string, string>();
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const n = typeof data.name === "string" ? data.name.trim() : "";
        m.set(d.id, n || "Category");
      }
      categoryNameById = m;
      catReady = true;
      emit();
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );

  const unsubProd = onSnapshot(
    collection(db, PRODUCTS_COLLECTION),
    (snap) => {
      productDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
      prodReady = true;
      emit();
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );

  return () => {
    unsubCat();
    unsubProd();
  };
}

/** Pick a display emoji from product/category name (UI only). */
export function menuProductEmoji(name: string, category: string): string {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes("mango") || c.includes("milk")) return "🥭";
  if (n.includes("orange") || c.includes("juice")) return "🥤";
  if (n.includes("salad") || c.includes("bowl")) return "🥗";
  if (n.includes("watermelon")) return "🍉";
  if (n.includes("banana")) return "🍌";
  if (n.includes("pineapple")) return "🍍";
  if (c.includes("snack") || n.includes("sandwich")) return "🥪";
  if (c.includes("dessert")) return "🍨";
  return "🍹";
}
