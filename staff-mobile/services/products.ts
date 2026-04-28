import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { staffDb } from "../src/lib/firebase";

export const PRODUCTS_COLLECTION = "products";
export const CATEGORIES_COLLECTION = "categories";

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  availability: boolean;
};

function mapProductDoc(
  id: string,
  data: Record<string, unknown>,
  categoryNameById: Map<string, string>
): MenuProduct | null {
  const name = typeof data.name === "string" ? data.name : "";
  if (!name.trim()) return null;
  const price = typeof data.price === "number" && Number.isFinite(data.price) ? data.price : Number(data.price) || 0;
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
  const availability =
    data.available !== false && data.availability !== false && data.isAvailable !== false;
  return {
    id: typeof data.id === "string" && data.id ? data.id : id,
    name: name.trim(),
    price: Math.max(0, price),
    category: category || "Other",
    image,
    availability
  };
}

/** Group products by `category` for menu UI. */
export function groupProductsByCategory(products: MenuProduct[]): Record<string, MenuProduct[]> {
  const map: Record<string, MenuProduct[]> = {};
  for (const p of products) {
    if (!p.availability) continue;
    const key = p.category || "Other";
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

export type ProductListRow =
  | { kind: "category"; title: string }
  | { kind: "product"; product: MenuProduct };

export function flattenProductsForList(grouped: Record<string, MenuProduct[]>): ProductListRow[] {
  const cats = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const rows: ProductListRow[] = [];
  for (const c of cats) {
    rows.push({ kind: "category", title: c });
    for (const p of grouped[c]) {
      rows.push({ kind: "product", product: p });
    }
  }
  return rows;
}

/**
 * Real-time `categories` + `products` — category names resolved for waiter menu (not raw IDs).
 */
export function subscribeMenuProducts(
  onNext: (products: MenuProduct[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let categoryNameById = new Map<string, string>();
  let productDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  let catReady = false;
  let prodReady = false;

  const emit = () => {
    if (!catReady || !prodReady) return;
    const list: MenuProduct[] = [];
    for (const { id, data } of productDocs) {
      const row = mapProductDoc(id, data, categoryNameById);
      if (row) list.push(row);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    onNext(list);
  };

  const unsubCat = onSnapshot(
    collection(staffDb, CATEGORIES_COLLECTION),
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
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );

  const unsubProd = onSnapshot(
    collection(staffDb, PRODUCTS_COLLECTION),
    (snap) => {
      productDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
      prodReady = true;
      emit();
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );

  return () => {
    unsubCat();
    unsubProd();
  };
}
