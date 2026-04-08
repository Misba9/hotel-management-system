import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const updateCategorySchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    priority: z.number().int().min(1).max(999).optional(),
    active: z.boolean().optional()
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
    await adminDb.collection("menu_categories").doc(id).set(
      {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.priority !== undefined ? { priority: Number(body.priority) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {})
      },
      { merge: true }
    );
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
