import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const optionalImageUrl = z.union([z.literal(""), z.string().url()]);

const updateCategorySchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    imageUrl: optionalImageUrl.optional(),
    priority: z.number().int().min(1).max(999).optional(),
    active: z.boolean().optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_categories_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    const body = updateCategorySchema.parse(await request.json());
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp()
    };
    if (body.name !== undefined) patch.name = body.name;
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
    if (body.priority !== undefined) patch.priority = Number(body.priority);
    if (body.isActive !== undefined || body.active !== undefined) {
      const flag = body.isActive !== undefined ? body.isActive : body.active!;
      patch.active = flag;
      patch.isActive = flag;
    }
    await adminDb.collection("menu_categories").doc(id).set(patch, { merge: true });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Categories PATCH error:", error);
    }
    return Response.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_categories_delete", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    await adminDb.collection("menu_categories").doc(id).delete();
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Categories DELETE error:", error);
    }
    return Response.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
