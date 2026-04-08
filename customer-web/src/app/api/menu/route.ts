import { fetchMenuFromFirestoreAdmin } from "@/lib/server/menu-firestore";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control":
    process.env.NODE_ENV === "development"
      ? "no-store, must-revalidate"
      : "public, s-maxage=30, stale-while-revalidate=120"
};

const MENU_CACHE_TTL_MS = process.env.NODE_ENV === "development" ? 0 : 30_000;

type MenuCachePayload = {
  categories: Awaited<ReturnType<typeof fetchMenuFromFirestoreAdmin>>["categories"];
  products: Awaited<ReturnType<typeof fetchMenuFromFirestoreAdmin>>["products"];
  /** Normalized product shape for debugging / external consumers */
  items: Array<{
    id: string;
    name: string;
    price: number;
    category: string;
    categoryId: string;
    image: string;
    available: boolean;
  }>;
};

let menuCache: { payload: MenuCachePayload; expiresAt: number } | null = null;

function toItemsPayload(products: MenuCachePayload["products"]): MenuCachePayload["items"] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.categoryName,
    categoryId: p.categoryId,
    image: p.image,
    available: p.available
  }));
}

export async function GET() {
  try {
    const now = Date.now();
    if (MENU_CACHE_TTL_MS > 0 && menuCache && menuCache.expiresAt > now) {
      if (process.env.NODE_ENV === "development") {
        console.info("[api/menu] cache hit", {
          products: menuCache.payload.products.length,
          categories: menuCache.payload.categories.length
        });
      }
      return Response.json(menuCache.payload, { status: 200, headers: CACHE_HEADERS });
    }

    const { categories, products } = await fetchMenuFromFirestoreAdmin();
    const payload: MenuCachePayload = {
      categories,
      products,
      items: toItemsPayload(products)
    };

    if (MENU_CACHE_TTL_MS > 0) {
      menuCache = { payload, expiresAt: now + MENU_CACHE_TTL_MS };
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[api/menu] response", {
        categories: categories.length,
        products: products.length,
        sample: products[0]
          ? {
              id: products[0].id,
              name: products[0].name,
              price: products[0].price,
              categoryId: products[0].categoryId
            }
          : null
      });
    }

    return Response.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[api/menu] failed.", error);
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
