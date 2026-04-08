import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const couponCreateSchema = z
  .object({
    code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
    discountType: z.enum(["flat", "percent", "fixed", "percentage"]).default("percent"),
    discountValue: z.number().positive().optional(),
    value: z.number().positive().optional(),
    minOrderAmount: z.number().min(0).optional(),
    minOrder: z.number().min(0).optional(),
    usageLimit: z.number().int().positive().default(100),
    expiryAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "expiryAt must be a valid date string."
    })
  })
  .refine((b) => b.discountValue != null || b.value != null, {
    message: "Provide discountValue or value."
  });

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_coupons_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("coupons").orderBy("expiryAt", "asc").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Coupons GET error:", error);
    }
    return Response.json({ error: "Failed to fetch coupons." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_coupons_post", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = couponCreateSchema.parse(await request.json());
    const ref = adminDb.collection("coupons").doc(body.code.toUpperCase());
    const storedType = body.discountType === "flat" || body.discountType === "fixed" ? "flat" : "percent";
    const storedValue = body.value ?? body.discountValue!;
    const storedMin = body.minOrder ?? body.minOrderAmount ?? 0;
    await ref.set({
      id: ref.id,
      code: body.code.toUpperCase(),
      active: true,
      discountType: storedType,
      discountValue: storedValue,
      value: storedValue,
      minOrderAmount: storedMin,
      minOrder: storedMin,
      usageLimit: body.usageLimit,
      usedCount: 0,
      expiryAt: body.expiryAt
    });
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Coupons POST error:", error);
    }
    return Response.json({ error: "Failed to create coupon." }, { status: 500 });
  }
}
