import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const inventoryCreateSchema = z.object({
  ingredientName: z.string().trim().min(2).max(120),
  currentStock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(10),
  unit: z.string().trim().min(1).max(20).default("kg")
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_inventory_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("inventory").orderBy("ingredientName").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Inventory GET error:", error);
    }
    return Response.json({ error: "Failed to fetch inventory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_inventory_post", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = inventoryCreateSchema.parse(await request.json());
    const ref = adminDb.collection("inventory").doc();
    const currentStock = body.currentStock;
    const minStock = body.minStock;
    await ref.set({
      id: ref.id,
      branchId: "hyderabad-main",
      ingredientName: body.ingredientName,
      unit: body.unit,
      currentStock,
      minStock,
      isLowStock: currentStock <= minStock,
      updatedAt: new Date().toISOString()
    });
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Inventory POST error:", error);
    }
    return Response.json({ error: "Failed to create inventory item." }, { status: 500 });
  }
}
