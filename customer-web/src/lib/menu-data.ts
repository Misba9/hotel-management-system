import type { Category, MenuPayload, Product } from "@/lib/menu-data-types";

export type { Category, MenuPayload, Product } from "@/lib/menu-data-types";

let cachedPayload: MenuPayload | null = null;
let inFlightRequest: Promise<MenuPayload> | null = null;

const isDevClient = process.env.NODE_ENV === "development";

export async function getMenuPayload(forceRefresh = false): Promise<MenuPayload> {
  const bustCache = forceRefresh || isDevClient;

  if (forceRefresh) {
    cachedPayload = null;
    inFlightRequest = null;
  }

  if (!isDevClient && cachedPayload && !forceRefresh) {
    return cachedPayload;
  }
  if (inFlightRequest && !forceRefresh) {
    return inFlightRequest;
  }

  inFlightRequest = fetchMenuFromApi(bustCache)
    .then((payload) => {
      if (!isDevClient) cachedPayload = payload;
      return payload;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

async function fetchMenuFromApi(bustCache: boolean): Promise<MenuPayload> {
  const url = bustCache ? `/api/menu?t=${Date.now()}` : "/api/menu";
  const res = await fetch(url, {
    cache: bustCache ? "no-store" : "default"
  });

  if (!res.ok) {
    const message = res.status === 500 ? "Server error while loading the menu." : `Menu request failed (${res.status}).`;
    throw new Error(message);
  }

  const data = (await res.json()) as { categories?: Category[]; products?: Product[]; error?: string };

  if (data.error) {
    throw new Error(data.error);
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const products = Array.isArray(data.products) ? data.products : [];

  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    console.info("[menu-data] /api/menu response", {
      categories: categories.length,
      products: products.length
    });
  }

  return {
    categories,
    products,
    fetchedAt: new Date().toISOString()
  };
}
