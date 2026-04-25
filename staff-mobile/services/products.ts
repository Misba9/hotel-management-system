import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { staffDb } from "../src/lib/firebase";

export const PRODUCTS_COLLECTION = "products";

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  availability: boolean;
};

function mapProductDoc(id: string, data: Record<string, unknown>): MenuProduct | null {
  const name = typeof data.name === "string" ? data.name : "";
  if (!name.trim()) return null;
  const price = typeof data.price === "number" && Number.isFinite(data.price) ? data.price : Number(data.price) || 0;
  const categoryRaw =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : typeof data.categoryId === "string" && data.categoryId.trim()
        ? data.categoryId.trim()
        : "Other";
  const image = typeof data.image === "string" ? data.image : "";
  const availability = typeof data.availability === "boolean" ? data.availability : true;
  return {
    id: typeof data.id === "string" && data.id ? data.id : id,
    name: name.trim(),
    price: Math.max(0, price),
    category: categoryRaw,
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

export function subscribeMenuProducts(
  onNext: (products: MenuProduct[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(staffDb, PRODUCTS_COLLECTION),
    (snap) => {
      const list: MenuProduct[] = [];
      for (const d of snap.docs) {
        const row = mapProductDoc(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      onNext(list);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}
