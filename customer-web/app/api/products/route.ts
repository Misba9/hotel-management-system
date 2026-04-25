import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { type Query } from "firebase-admin/firestore";
import { adminDb, getFirebaseAdminApp } from "@shared/firebase/admin";
import { resolveMenuImageSrc } from "@/lib/image-url";
import { fetchCategoryNameLookup } from "@/lib/server/menu-firestore";
import { z } from "zod";

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

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" };
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional(),
  cursor: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional()
});

function isProductAvailable(row: Record<string, unknown>): boolean {
  return row.availability === true || row.available === true;
}

function rowCategoryId(row: Record<string, unknown>): string {
  return String(row.categoryId ?? row.category ?? "uncategorized");
}

function toProductRecord(d: QueryDocumentSnapshot, categoryLookup: Map<string, string>): ProductRecord {
  const row = d.data() as Record<string, unknown>;
  const catId = rowCategoryId(row);
  const explicit = String(row.categoryName ?? "").trim();
  const legacyCategory = String(row.category ?? "").trim();
  const fromCollection = categoryLookup.get(catId)?.trim() ?? "";
  const explicitOk = Boolean(explicit) && explicit !== catId;
  const legacyOk = Boolean(legacyCategory) && legacyCategory !== catId;
  const categoryName =
    fromCollection ||
    (explicitOk ? explicit : "") ||
    (legacyOk ? legacyCategory : "") ||
    (catId === "uncategorized" ? "Uncategorized" : "") ||
    "Other";

  return {
    id: String(row.id ?? d.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    categoryId: catId,
    categoryName,
    price: Number(row.price ?? 0),
    rating: Number(row.rating ?? 4.5),
    image: resolveMenuImageSrc(String(row.image ?? row.imageUrl ?? "").trim() || null),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients.map((x) => String(x)) : [],
    sizes: [{ label: "Medium", multiplier: 1 }],
    available: isProductAvailable(row),
    featured: Boolean(row.featured ?? row.isFeatured),
    popular: Boolean(row.popular ?? row.isPopular)
  };
}

function toCategoryRecords(products: ProductRecord[]): CategoryRecord[] {
  const map = new Map<string, CategoryRecord>();
  for (const p of products) {
    const key = p.categoryId || "uncategorized";
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    map.set(key, {
      id: key,
      name: p.categoryName || key.replace(/_/g, " "),
      image: p.image || "",
      count: 1
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const MAX_SCAN = 4000;

/**
 * Paginate with a single-field query (`orderBy("name")` only) and filter in memory.
 * Avoids composite indexes on `availability` + `categoryId` + `name`.
 */
async function fetchProductPage(args: {
  pageSize: number;
  cursor: string | null;
  categoryId: string | null;
  categoryLookup: Map<string, string>;
}): Promise<{ products: ProductRecord[]; hasMore: boolean; nextCursor: string | null }> {
  const { pageSize, categoryId, categoryLookup } = args;
  const col = adminDb.collection("products");

  let q: Query = col.orderBy("name", "asc");
  if (args.cursor) {
    const cursorSnap = await col.doc(args.cursor).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }

  const page: ProductRecord[] = [];
  let scanned = 0;

  while (page.length < pageSize + 1 && scanned < MAX_SCAN) {
    const batch = await q.limit(80).get();
    if (batch.empty) break;

    for (const d of batch.docs) {
      scanned += 1;
      const row = d.data() as Record<string, unknown>;
      if (!isProductAvailable(row)) continue;
      if (categoryId && rowCategoryId(row) !== categoryId) continue;
      const name = String(row.name ?? "").trim();
      if (name.toLowerCase() === "test") continue;
      page.push(toProductRecord(d, categoryLookup));
      if (page.length === pageSize + 1) break;
    }

    if (page.length === pageSize + 1) break;

    const last = batch.docs[batch.docs.length - 1];
    q = col.orderBy("name", "asc").startAfter(last);
    if (batch.size < 80) break;
  }

  const hasMore = page.length > pageSize;
  const slice = hasMore ? page.slice(0, pageSize) : page;
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

  return { products: slice, hasMore, nextCursor };
}

export async function GET(request: Request) {
  try {
    if (!getFirebaseAdminApp()) {
      console.error(
        "[api/products] Firebase Admin is not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS)."
      );
      return Response.json(
        {
          error: "Menu service unavailable",
          details: "Server could not connect to Firestore."
        },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined
    });
    if (!parsed.success) {
      return Response.json({ error: "Invalid query params." }, { status: 400 });
    }
    const pageSize = parsed.data.limit ?? 24;
    const cursor = parsed.data.cursor ?? null;
    const categoryId = parsed.data.categoryId ?? null;

    const categoryLookup = await fetchCategoryNameLookup();

    const { products, hasMore, nextCursor } = await fetchProductPage({
      pageSize,
      cursor,
      categoryId,
      categoryLookup
    });

    const categories = toCategoryRecords(products);

    return Response.json(
      {
        products,
        categories,
        pageInfo: { hasMore, nextCursor },
        fetchedAt: new Date().toISOString()
      },
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error("[api/products] failed.", error);
    return Response.json(
      {
        error: "Failed to fetch menu",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
