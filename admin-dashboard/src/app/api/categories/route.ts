import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" };

const createCategorySchema = z.object({
  name: z.string().min(2).max(120),
  priority: z.number().int().min(1).max(999).optional(),
  active: z.boolean().optional()
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_categories_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("menu_categories").orderBy("priority", "asc").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Categories GET error:", error);
    }
    return Response.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_categories_post", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = createCategorySchema.parse(await request.json());
    const ref = adminDb.collection("menu_categories").doc();
    await ref.set({
      id: ref.id,
      branchId: "hyderabad-main",
      name: body.name.trim(),
      priority: Number(body.priority ?? 50),
      active: body.active ?? true
    });
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Categories POST error:", error);
    }
    return Response.json({ error: "Failed to create category." }, { status: 500 });
  }
}
