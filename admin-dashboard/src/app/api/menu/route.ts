import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

const menuCreateSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.number().nonnegative(),
  categoryId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  available: z.boolean().optional()
});

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_menu_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const snap = await adminDb.collection("menu_items").orderBy("name").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu GET error:", error);
    }
    return Response.json({ error: "Failed to fetch menu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_menu_post", limit: 30, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = menuCreateSchema.parse(await request.json());
    const ref = adminDb.collection("menu_items").doc();
    await ref.set({
      id: ref.id,
      name: body.name,
      price: body.price,
      categoryId: body.categoryId ?? "fresh_juices",
      branchId: body.branchId ?? "hyderabad-main",
      description: body.description ?? "",
      available: body.available ?? true,
      imageUrl: body.imageUrl ?? "",
      tags: []
    });
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
