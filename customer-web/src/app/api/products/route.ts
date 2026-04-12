import { type Query } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
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

export async function GET(request: Request) {
  try {
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

    let base: Query = adminDb.collection("products").where("availability", "==", true).orderBy("name", "asc");
    if (categoryId) {
      base = adminDb
        .collection("products")
        .where("categoryId", "==", categoryId)
        .where("availability", "==", true)
        .orderBy("name", "asc");
    }

    if (cursor) {
      const cursorSnap = await adminDb.collection("products").doc(cursor).get();
      if (cursorSnap.exists) {
        base = base.startAfter(cursorSnap);
      }
    }

    const snap = await base.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const products: ProductRecord[] = docs.map((d) => {
      const row = d.data() as Record<string, unknown>;
      return {
        id: String(row.id ?? d.id),
        name: String(row.name ?? ""),
        description: String(row.description ?? ""),
        categoryId: String(row.categoryId ?? row.category ?? "uncategorized"),
        categoryName: String(row.categoryName ?? row.category ?? "Uncategorized"),
        price: Number(row.price ?? 0),
        rating: Number(row.rating ?? 4.5),
        image: String(row.image ?? row.imageUrl ?? ""),
        ingredients: Array.isArray(row.ingredients) ? row.ingredients.map((x) => String(x)) : [],
        sizes: [{ label: "Medium", multiplier: 1 }],
        available: row.availability === true || row.available === true,
        featured: Boolean(row.featured ?? row.isFeatured),
        popular: Boolean(row.popular ?? row.isPopular)
      };
    });

    const categories = toCategoryRecords(products);
    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;
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
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
