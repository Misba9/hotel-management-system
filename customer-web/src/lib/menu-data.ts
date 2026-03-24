"use client";

export type Product = {
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
  featured?: boolean;
  popular?: boolean;
};

export type Category = {
  id: string;
  name: string;
  image: string;
  count: number;
};

export type MenuPayload = {
  products: Product[];
  categories: Category[];
  fetchedAt: string;
};

type MenuApiResponse =
  | { success: true; data: MenuPayload | Product[] }
  | { success?: false; error?: string }
  | MenuPayload;

let cachedPayload: MenuPayload | null = null;
let inFlightRequest: Promise<MenuPayload> | null = null;

export async function getMenuPayload(forceRefresh = false): Promise<MenuPayload> {
  if (cachedPayload && !forceRefresh) {
    return cachedPayload;
  }
  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = fetch("/api/menu")
    .then(async (response) => {
      const payload = (await response.json()) as MenuApiResponse;
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to load menu.";
        throw new Error(message);
      }

      return normalizePayload(payload);
    })
    .then((payload) => {
      cachedPayload = payload;
      return payload;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

function normalizePayload(payload: MenuApiResponse): MenuPayload {
  if (isMenuPayload(payload)) return payload;
  if (typeof payload === "object" && payload && "success" in payload && payload.success === true) {
    const data = payload.data;
    if (isMenuPayload(data)) return data;
    if (Array.isArray(data)) {
      const products = data.filter(isProduct);
      return {
        products,
        categories: buildCategories(products),
        fetchedAt: new Date().toISOString()
      };
    }
  }

  throw new Error("Failed to load menu.");
}

function isMenuPayload(value: unknown): value is MenuPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MenuPayload>;
  return Array.isArray(candidate.products) && Array.isArray(candidate.categories) && typeof candidate.fetchedAt === "string";
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Product>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.categoryId === "string";
}

function buildCategories(products: Product[]): Category[] {
  const grouped = new Map<string, Category>();
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
