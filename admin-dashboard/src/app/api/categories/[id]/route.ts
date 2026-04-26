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

const COLLECTION = "categories";
const LEGACY = "menu_categories";

async function cascadeCategoryNameToProducts(categoryId: string, newName: string) {
  const [byId, byLegacy] = await Promise.all([
    adminDb.collection("products").where("categoryId", "==", categoryId).get(),
    adminDb.collection("products").where("category", "==", categoryId).get()
  ]);
  const seen = new Set<string>();
  const docs = [...byId.docs, ...byLegacy.docs].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
  const trimmed = newName.trim();
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = adminDb.batch();
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.set(
        d.ref,
        {
          categoryName: trimmed,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

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
    if (body.imageUrl !== undefined) {
      patch.imageUrl = body.imageUrl;
      patch.image = body.imageUrl;
    }
    if (body.priority !== undefined) patch.priority = Number(body.priority);
    if (body.isActive !== undefined || body.active !== undefined) {
      const flag = body.isActive !== undefined ? body.isActive : body.active!;
      patch.active = flag;
      patch.isActive = flag;
    }
    await adminDb.collection(COLLECTION).doc(id).set(patch, { merge: true });
    if (body.name !== undefined) {
      await cascadeCategoryNameToProducts(id, body.name);
    }
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
    const [byId, byLegacy] = await Promise.all([
      adminDb.collection("products").where("categoryId", "==", id).limit(1).get(),
      adminDb.collection("products").where("category", "==", id).limit(1).get()
    ]);
    if (!byId.empty || !byLegacy.empty) {
      return Response.json(
        { error: "Cannot delete category while products reference it. Reassign or delete those products first." },
        { status: 409 }
      );
    }
    await Promise.all([
      adminDb.collection(COLLECTION).doc(id).delete(),
      adminDb.collection(LEGACY).doc(id).delete()
    ]);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Categories DELETE error:", error);
    }
    return Response.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
