import { adminDb } from "@shared/firebase/admin";
import type { Category, Product } from "@/lib/menu-data-types";
import { MENU_IMAGE_FALLBACK, resolveMenuImageSrc } from "@/lib/image-url";

const DEFAULT_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80";

/** Storefront catalog collections (see `backend/firestore.rules` — `categories`, `products`). */
const CATEGORIES_COLLECTION = "categories";
const LEGACY_CATEGORIES_COLLECTION = "menu_categories";
const PRODUCTS_COLLECTION = "products";

type FirestoreCategoryDoc = {
  name?: unknown;
  active?: unknown;
  isActive?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  sortOrder?: unknown;
  priority?: unknown;
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
 * Loads menu for the storefront from Firestore `categories` and `products`.
 * Product fields: id, name, price, image, categoryId, isPopular, isAvailable (plus optional legacy aliases).
 */
/** Category id → display name (active + inactive with a `name` field). */
export async function fetchCategoryNameLookup(): Promise<Map<string, string>> {
  const [snap, legacySnap] = await Promise.all([
    adminDb.collection(CATEGORIES_COLLECTION).get(),
    adminDb.collection(LEGACY_CATEGORIES_COLLECTION).get()
  ]);
  const map = new Map<string, string>();
  for (const docSnap of legacySnap.docs) {
    const mapped = mapCategoryDoc(docSnap.id, docSnap.data() as FirestoreCategoryDoc);
    if (mapped) map.set(mapped.id, mapped.name);
  }
  for (const docSnap of snap.docs) {
    const mapped = mapCategoryDoc(docSnap.id, docSnap.data() as FirestoreCategoryDoc);
    if (mapped) map.set(mapped.id, mapped.name);
  }
  return map;
}

export async function fetchMenuFromFirestoreAdmin(): Promise<{
  categories: Category[];
  products: Product[];
}> {
  const [categorySnap, legacyCatSnap, productSnap] = await Promise.all([
    adminDb.collection(CATEGORIES_COLLECTION).get(),
    adminDb.collection(LEGACY_CATEGORIES_COLLECTION).get(),
    adminDb.collection(PRODUCTS_COLLECTION).get()
  ]);

  if (process.env.NODE_ENV !== "production") {
    console.info("[menu-firestore] raw Firestore snapshot", {
      collectionCategories: CATEGORIES_COLLECTION,
      legacyCategories: LEGACY_CATEGORIES_COLLECTION,
      collectionItems: PRODUCTS_COLLECTION,
      categoryDocs: categorySnap.size,
      legacyCategoryDocs: legacyCatSnap.size,
      itemDocs: productSnap.size
    });
  }

  const categoryRows: CategoryRow[] = [];
  for (const docSnap of legacyCatSnap.docs) {
    const mapped = mapCategoryDoc(docSnap.id, docSnap.data() as FirestoreCategoryDoc);
    if (mapped) categoryRows.push(mapped);
  }
  for (const docSnap of categorySnap.docs) {
    const mapped = mapCategoryDoc(docSnap.id, docSnap.data() as FirestoreCategoryDoc);
    if (mapped) {
      const idx = categoryRows.findIndex((c) => c.id === mapped.id);
      if (idx >= 0) categoryRows[idx] = mapped;
      else categoryRows.push(mapped);
    }
  }

  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  const products: Product[] = [];
  for (const docSnap of productSnap.docs) {
    const p = mapProductDoc(docSnap.id, docSnap.data() as FirestoreProductDoc, categoryById);
    if (p && p.available !== false) {
      products.push(p);
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name));

  const categories = buildCategoryList(categoryRows, products);

  if (process.env.NODE_ENV !== "production") {
    console.info("[menu-firestore] mapped menu", {
      categories: categories.length,
      products: products.length
    });
  }

  return { categories, products };
}

function mapCategoryDoc(id: string, data: FirestoreCategoryDoc): CategoryRow | null {
  const name = String(data.name ?? "").trim();
  if (!id || !name) return null;
  const active = data.isActive !== false && data.active !== false;
  const sortRaw = data.sortOrder ?? data.priority;
  const sortOrder =
    typeof sortRaw === "number" && Number.isFinite(sortRaw) ? sortRaw : Number(sortRaw) || 50;
  const image = String(data.image ?? (data as { imageUrl?: unknown }).imageUrl ?? "").trim();
  return { id, name, image, sortOrder, active };
}

function mapProductDoc(
  id: string,
  raw: FirestoreProductDoc,
  categories: Map<string, CategoryRow>
): Product | null {
  const name = String(raw.name ?? "").trim();
  const categoryId = String(raw.categoryId ?? raw.category ?? "").trim();
  const price = Number(raw.price ?? NaN);
  if (!name || !Number.isFinite(price) || price < 0) return null;
  if (name.toLowerCase() === "test") return null;

  const available =
    raw.isAvailable !== false &&
    raw.available !== false &&
    raw.is_available !== false;

  const popular = Boolean(raw.isPopular ?? raw.popular ?? raw.is_popular);
  const featured = Boolean(raw.featured ?? raw.isFeatured);

  const effectiveCategoryId = categoryId || "uncategorized";
  const explicit = String(raw.categoryName ?? "").trim();
  const fromCollection = categories.get(effectiveCategoryId)?.name?.trim() ?? "";
  const explicitOk =
    Boolean(explicit) && explicit !== effectiveCategoryId && explicit !== categoryId;
  const categoryName =
    fromCollection ||
    (explicitOk ? explicit : "") ||
    (effectiveCategoryId === "uncategorized" ? "Uncategorized" : "") ||
    "Other";

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
  let image: string;
  if (!imageRaw) {
    image = DEFAULT_PLACEHOLDER_IMAGE;
  } else {
    const resolved = resolveMenuImageSrc(imageRaw);
    image = resolved === MENU_IMAGE_FALLBACK ? DEFAULT_PLACEHOLDER_IMAGE : resolved;
  }

  const legacyCategory = String(raw.category ?? "").trim();

  return {
    id,
    name,
    description: String(raw.description ?? ""),
    categoryId: effectiveCategoryId,
    categoryName,
    ...(legacyCategory ? { category: legacyCategory } : {}),
    price,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : 4.5,
    image,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map((item) => String(item)) : [],
    sizes: sizes.length > 0 ? sizes : [{ label: "Medium", multiplier: 1 }],
    available,
    isAvailable: available,
    featured,
    popular
  };
}

function buildCategoryList(categoryRows: CategoryRow[], products: Product[]): Category[] {
  const fromFirestore = categoryRows
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, image: c.image || DEFAULT_PLACEHOLDER_IMAGE, sortOrder: c.sortOrder }));

  const idSet = new Set(fromFirestore.map((c) => c.id));

  for (const product of products) {
    if (!idSet.has(product.categoryId)) {
      fromFirestore.push({
        id: product.categoryId,
        name: product.categoryName,
        image: DEFAULT_PLACEHOLDER_IMAGE,
        sortOrder: 9999
      });
      idSet.add(product.categoryId);
    }
  }

  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }

  const activeById = new Map(categoryRows.map((r) => [r.id, r.active]));

  return fromFirestore
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      count: counts.get(c.id) ?? 0,
      isActive: activeById.has(c.id) ? activeById.get(c.id)! : true
    }));
}
