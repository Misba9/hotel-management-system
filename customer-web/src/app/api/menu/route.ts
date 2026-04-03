import { fetchMenuFromFirestoreAdmin } from "@/lib/server/menu-firestore";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
const MENU_CACHE_TTL_MS = 60_000;

type MenuCachePayload = {
  categories: Awaited<ReturnType<typeof fetchMenuFromFirestoreAdmin>>["categories"];
  products: Awaited<ReturnType<typeof fetchMenuFromFirestoreAdmin>>["products"];
};

let menuCache: { payload: MenuCachePayload; expiresAt: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (menuCache && menuCache.expiresAt > now) {
      return Response.json(menuCache.payload, { status: 200, headers: CACHE_HEADERS });
    }

    const { categories, products } = await fetchMenuFromFirestoreAdmin();
    const payload: MenuCachePayload = { categories, products };
    menuCache = { payload, expiresAt: now + MENU_CACHE_TTL_MS };
    return Response.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Menu API failed.", error);
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
