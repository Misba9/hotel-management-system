import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const inventoryUpdateSchema = z
  .object({
    currentStock: z.number().min(0).optional(),
    minStock: z.number().min(0).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_inventory_patch", limit: 80, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    const body = inventoryUpdateSchema.parse(await request.json());
    const snap = await adminDb.collection("inventory").doc(id).get();
    if (!snap.exists) {
      return Response.json({ error: "Inventory item not found." }, { status: 404 });
    }
    const existing = snap.data() as { currentStock?: number; minStock?: number };
    const currentStock = body.currentStock ?? Number(existing.currentStock ?? 0);
    const minStock = body.minStock ?? Number(existing.minStock ?? 0);
    await adminDb.collection("inventory").doc(id).set(
      {
        currentStock,
        minStock,
        isLowStock: currentStock <= minStock,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Inventory PATCH error:", error);
    }
    return Response.json({ error: "Failed to update inventory." }, { status: 500 });
  }
}
