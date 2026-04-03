import { adminDb } from "@shared/firebase/admin";
import type { Category, Product } from "@/lib/menu-data-types";

const DEFAULT_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80";

type FirestoreCategoryDoc = {
  name?: unknown;
  image?: unknown;
  active?: unknown;
  sortOrder?: unknown;
};

type FirestoreProductDoc = Record<string, unknown>;

type CategoryRow = {
  id: string;
  name: string;
  image: string;
  sortOrder: number;
  active: boolean;
};

/**
 * Loads categories and available products from Firestore via Admin SDK.
 * Collections: `categories` (name, image), `products` (name, price, categoryId, image, available, …).
 */
export async function fetchMenuFromFirestoreAdmin(): Promise<{
  categories: Category[];
  products: Product[];
}> {
  const [categorySnap, productSnap] = await Promise.all([
    adminDb.collection("categories").get(),
    adminDb.collection("products").get()
  ]);

  const categoryRows: CategoryRow[] = [];
  for (const docSnap of categorySnap.docs) {
    const mapped = mapCategoryDoc(docSnap.id, docSnap.data() as FirestoreCategoryDoc);
    if (mapped) categoryRows.push(mapped);
  }

  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  const products: Product[] = [];
  for (const docSnap of productSnap.docs) {
    const p = mapProductDoc(docSnap.id, docSnap.data() as FirestoreProductDoc, categoryById);
    if (p && p.available !== false) {
      products.push(p);
    }
  }

  const categories = buildCategoryList(categoryRows, products);

  return { categories, products };
}

function mapCategoryDoc(id: string, data: FirestoreCategoryDoc): CategoryRow | null {
  const name = String(data.name ?? "").trim();
  if (!id || !name) return null;
  const active = data.active !== false;
  const sortOrder = typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder) ? data.sortOrder : 0;
  const image = String(data.image ?? "").trim();
  return { id, name, image, sortOrder, active };
}

function mapProductDoc(
  id: string,
  raw: FirestoreProductDoc,
  categories: Map<string, CategoryRow>
): Product | null {
  const name = String(raw.name ?? "").trim();
  const categoryId = String(raw.categoryId ?? "").trim();
  const price = Number(raw.price ?? NaN);
  if (!name || !categoryId || !Number.isFinite(price)) return null;

  const categoryNameFromDoc = String(raw.categoryName ?? "").trim();
  const categoryName =
    categoryNameFromDoc || categories.get(categoryId)?.name || "Menu";

  const sizesRaw = Array.isArray(raw.sizes) ? raw.sizes : [];
  const sizes = sizesRaw
    .map((entry) => {
      const label = String((entry as { label?: unknown }).label ?? "");
      const multiplier = Number((entry as { multiplier?: unknown }).multiplier ?? NaN);
      if (
        (label !== "Small" && label !== "Medium" && label !== "Large") ||
        !Number.isFinite(multiplier) ||
        multiplier <= 0
      ) {
        return null;
      }
      return { label, multiplier } as { label: "Small" | "Medium" | "Large"; multiplier: number };
    })
    .filter((value): value is { label: "Small" | "Medium" | "Large"; multiplier: number } => Boolean(value));

  const imageRaw = String(raw.image ?? raw.imageUrl ?? "").trim();

  return {
    id,
    name,
    description: String(raw.description ?? ""),
    categoryId,
    categoryName,
    price,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : 4.5,
    image: imageRaw || DEFAULT_PLACEHOLDER_IMAGE,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map((item) => String(item)) : [],
    sizes: sizes.length > 0 ? sizes : [{ label: "Medium", multiplier: 1 }],
    available: raw.available !== false,
    featured: Boolean(raw.featured),
    popular: Boolean(raw.popular)
  };
}

function buildCategoryList(categoryRows: CategoryRow[], products: Product[]): Category[] {
  const fromFirestore = categoryRows
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, image: c.image, sortOrder: c.sortOrder }));

  const idSet = new Set(fromFirestore.map((c) => c.id));

  for (const product of products) {
    if (!idSet.has(product.categoryId)) {
      fromFirestore.push({
        id: product.categoryId,
        name: product.categoryName,
        image: "",
        sortOrder: 9999
      });
      idSet.add(product.categoryId);
    }
  }

  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }

  return fromFirestore
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image || DEFAULT_PLACEHOLDER_IMAGE,
      count: counts.get(c.id) ?? 0
    }));
}
