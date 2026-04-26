import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

const optionalImageUrl = z.union([z.literal(""), z.string().url()]);

const menuCreateSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.number().nonnegative(),
  /** Optional client-generated Firestore doc id (matches Storage upload path). */
  id: z.string().min(10).max(128).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).max(120).optional(),
  branchId: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  size: z.string().max(120).optional(),
  ingredients: z.string().max(4000).optional(),
  imageUrl: optionalImageUrl.optional(),
  available: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  rating: z.number().finite().min(0).max(5).optional()
});

async function resolveCategoryName(categoryId: string | undefined): Promise<string> {
  if (!categoryId) return "";
  const snap = await adminDb.collection("categories").doc(categoryId).get();
  if (snap.exists) return String(snap.data()?.name ?? "");
  const legacy = await adminDb.collection("menu_categories").doc(categoryId).get();
  return String(legacy.data()?.name ?? "");
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_menu_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const [catSnap, legacyCatSnap, snap] = await Promise.all([
      adminDb.collection("categories").get(),
      adminDb.collection("menu_categories").get(),
      adminDb.collection("products").orderBy("name").get()
    ]);
    const categoryNameByDocId = new Map<string, string>();
    const categoryIdByName = new Map<string, string>();
    const registerCat = (cd: QueryDocumentSnapshot) => {
      const data = cd.data() as Record<string, unknown>;
      const name = String(data.name ?? "").trim();
      categoryNameByDocId.set(cd.id, name);
      if (name) categoryIdByName.set(name.toLowerCase(), cd.id);
    };
    legacyCatSnap.docs.forEach(registerCat);
    catSnap.docs.forEach(registerCat);

    const items = snap.docs.map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      const rawCategoryId = String(d.categoryId ?? "").trim();
      const rawCategory = String(d.category ?? "").trim();
      const rawCategoryName = String(d.categoryName ?? "").trim();
      const categoryId =
        rawCategoryId ||
        categoryIdByName.get(rawCategory.toLowerCase()) ||
        categoryIdByName.get(rawCategoryName.toLowerCase()) ||
        rawCategory;
      const available = d.available !== false && d.availability !== false && d.isAvailable !== false;
      const storedName = rawCategoryName;
      const resolvedName =
        storedName || (categoryId ? categoryNameByDocId.get(categoryId) ?? "" : "");
      return {
        id: doc.id,
        name: String(d.name ?? ""),
        price: Number(d.price ?? 0),
        categoryId,
        categoryName: resolvedName,
        imageUrl: String(d.imageUrl ?? d.image ?? ""),
        size: String(d.size ?? ""),
        ingredients: String(d.ingredients ?? d.description ?? ""),
        available
      };
    });
    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/menu] GET products", { count: items.length });
    }
    return Response.json({ items }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu GET error:", error);
    }
    return Response.json({ error: "Failed to fetch menu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_menu_post", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = menuCreateSchema.parse(await request.json());
    const ref = body.id ? adminDb.collection("products").doc(body.id) : adminDb.collection("products").doc();
    const categoryId = body.categoryId ?? "fresh_juices";
    let categoryName = (body.categoryName ?? "").trim();
    if (!categoryName) {
      categoryName = await resolveCategoryName(categoryId);
    }
    const available = body.isAvailable ?? body.available ?? true;
    const ingredients = (body.ingredients ?? body.description ?? "").trim();
    const size = (body.size ?? "").trim();
    await ref.set({
      id: ref.id,
      name: body.name,
      price: body.price,
      image: body.imageUrl ?? "",
      imageUrl: body.imageUrl ?? "",
      /** Denormalized display name — must match `categories/{id}.name` for customer menu linking. */
      category: categoryName,
      categoryId,
      categoryName,
      size,
      ingredients,
      availability: available,
      isAvailable: available,
      branchId: body.branchId ?? "hyderabad-main",
      description: ingredients || body.description?.trim() || "",
      available,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      tags: [],
      rating: typeof body.rating === "number" && Number.isFinite(body.rating) ? body.rating : 4.5
    });
    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/menu] created product", { id: ref.id, name: body.name });
    }
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu POST error:", error);
    }
    return Response.json({ error: "Failed to create menu item." }, { status: 500 });
  }
}
