import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const optionalImageUrl = z.union([z.literal(""), z.string().url()]);

/**
 * Partial product PATCH (e.g. availability toggle sends only `available`).
 * Do not use `.min(1)` on optional strings — `""` is sent for cleared names and fails `min(1)` while still "present".
 */
const menuUpdateSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    price: z.coerce.number().finite().nonnegative().optional(),
    categoryId: z.string().min(1).max(128).optional(),
    categoryName: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    size: z.string().max(120).optional(),
    ingredients: z.string().max(4000).optional(),
    imageUrl: optionalImageUrl.optional(),
    available: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    rating: z.number().finite().min(0).max(5).optional()
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one field is required."
  });

async function resolveCategoryName(categoryId: string): Promise<string> {
  const snap = await adminDb.collection("categories").doc(categoryId).get();
  if (snap.exists) return String(snap.data()?.name ?? "");
  const legacy = await adminDb.collection("menu_categories").doc(categoryId).get();
  return String(legacy.data()?.name ?? "");
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_menu_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    const raw = (await request.json()) as Record<string, unknown>;
    const body = menuUpdateSchema.parse(raw);

    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/menu] PATCH body", { id, keys: Object.keys(body) });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.price !== undefined) {
      const p = Number(body.price);
      if (!Number.isFinite(p) || p < 0) {
        return Response.json({ error: "Invalid price." }, { status: 400 });
      }
      updates.price = p;
    }
    if (body.imageUrl !== undefined) {
      updates.imageUrl = body.imageUrl;
      updates.image = body.imageUrl;
    }
    if (body.categoryId !== undefined) {
      updates.categoryId = body.categoryId;
      const cn = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
      const resolvedName = cn || (await resolveCategoryName(body.categoryId));
      updates.categoryName = resolvedName;
      /** Same string customer menu matches to `categories[].name` (case-insensitive there). */
      updates.category = resolvedName;
    } else if (body.categoryName !== undefined) {
      const trimmed = body.categoryName.trim();
      updates.categoryName = trimmed;
      updates.category = trimmed;
    }
    if (body.size !== undefined) updates.size = body.size;
    if (body.ingredients !== undefined) {
      updates.ingredients = body.ingredients;
      updates.description = body.ingredients;
    } else if (body.description !== undefined) {
      updates.description = body.description;
    }
    const avail = body.isAvailable ?? body.available;
    if (avail !== undefined) {
      updates.available = avail;
      updates.availability = avail;
      updates.isAvailable = avail;
    }
    if (body.rating !== undefined) {
      updates.rating = body.rating;
    }
    await adminDb.collection("products").doc(id).set(updates, { merge: true });
    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/menu] updated product", { id, keys: Object.keys(updates) });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid payload.", details: error.issues, fieldErrors: error.flatten().fieldErrors },
        { status: 400 }
      );
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
    await adminDb.collection("products").doc(id).delete();
    if (process.env.NODE_ENV !== "production") {
      console.info("[admin/menu] deleted product", { id });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Menu DELETE error:", error);
    }
    return Response.json({ error: "Failed to delete menu item." }, { status: 500 });
  }
}
