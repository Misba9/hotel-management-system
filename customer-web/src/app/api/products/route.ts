import { adminDb } from "@shared/firebase/admin";

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  rating: number;
  image: string;
  ingredients: string[];
  sizes: Array<{ label: "Small" | "Medium" | "Large"; multiplier: number }>;
  available: boolean;
  featured: boolean;
  popular: boolean;
};

type CategoryRecord = {
  id: string;
  name: string;
  image: string;
  count: number;
};

type ProductsPayload = {
  products: ProductRecord[];
  categories: CategoryRecord[];
  fetchedAt: string;
};

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
const MENU_CACHE_TTL_MS = 60_000;

let menuCache: { payload: ProductsPayload; expiresAt: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (menuCache && menuCache.expiresAt > now) {
      return Response.json({ success: true, data: menuCache.payload }, { status: 200, headers: CACHE_HEADERS });
    }

    let products: ProductRecord[] = [];
    try {
      const snap = await adminDb.collection("products").where("available", "==", true).get();
      products = snap.docs
        .map((doc) => normalizeProduct(doc.id, doc.data() as Record<string, unknown>))
        .filter((item): item is ProductRecord => Boolean(item))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (dbError) {
      console.error("Menu API product query failed, returning empty menu.", dbError);
    }

    const categories = buildCategories(products);
    const payload: ProductsPayload = {
      products,
      categories,
      fetchedAt: new Date().toISOString()
    };

    menuCache = { payload, expiresAt: now + MENU_CACHE_TTL_MS };
    return Response.json({ success: true, data: payload }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Menu API failed.", error);
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}

function normalizeProduct(id: string, raw: Record<string, unknown>): ProductRecord | null {
  const name = String(raw.name ?? "").trim();
  const categoryId = String(raw.categoryId ?? "").trim();
  const categoryName = String(raw.categoryName ?? "").trim();
  const price = Number(raw.price ?? NaN);

  if (!name || !categoryId || !categoryName || !Number.isFinite(price)) {
    return null;
  }

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

  return {
    id,
    name,
    description: String(raw.description ?? ""),
    categoryId,
    categoryName,
    price,
    rating: Number(raw.rating ?? 4.5),
    image: String(raw.image ?? raw.imageUrl ?? ""),
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map((item) => String(item)) : [],
    sizes,
    available: raw.available !== false,
    featured: Boolean(raw.featured),
    popular: Boolean(raw.popular)
  };
}

function buildCategories(products: ProductRecord[]): CategoryRecord[] {
  const grouped = new Map<string, CategoryRecord>();
  for (const product of products) {
    const existing = grouped.get(product.categoryId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(product.categoryId, {
      id: product.categoryId,
      name: product.categoryName,
      image: "",
      count: 1
    });
  }
  return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
}
