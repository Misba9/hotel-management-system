import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const optionalImageUrl = z.union([z.literal(""), z.string().url()]);

const menuUpdateSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    price: z.number().nonnegative().optional(),
    categoryId: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    imageUrl: optionalImageUrl.optional(),
    available: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_menu_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    const body = menuUpdateSchema.parse(await request.json());
    await adminDb.collection("menu_items").doc(id).set(body, { merge: true });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu PATCH error:", error);
    }
    return Response.json({ error: "Failed to update menu item." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_menu_delete", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    await adminDb.collection("menu_items").doc(id).delete();
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu DELETE error:", error);
    }
    return Response.json({ error: "Failed to delete menu item." }, { status: 500 });
  }
}
