import { fetchMenuFromFirestoreAdmin } from "@/lib/server/menu-firestore";

export const dynamic = "force-dynamic";

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

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" };
const MENU_CACHE_TTL_MS = 30_000;

let menuCache: { payload: ProductsPayload; expiresAt: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (menuCache && menuCache.expiresAt > now) {
      return Response.json({ success: true, data: menuCache.payload }, { status: 200, headers: CACHE_HEADERS });
    }

    const { categories, products } = await fetchMenuFromFirestoreAdmin();
    const payload: ProductsPayload = {
      products: products as ProductRecord[],
      categories: categories as CategoryRecord[],
      fetchedAt: new Date().toISOString()
    };

    menuCache = { payload, expiresAt: now + MENU_CACHE_TTL_MS };
    return Response.json({ success: true, data: payload }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[api/products] failed.", error);
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
