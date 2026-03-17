import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const couponCreateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  discountType: z.enum(["flat", "percent"]).default("percent"),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).default(0),
  usageLimit: z.number().int().positive().default(100),
  expiryAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expiryAt must be a valid date string."
  })
});

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_coupons_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const snap = await adminDb.collection("coupons").orderBy("expiryAt", "asc").get();
    const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Coupons GET error:", error);
    }
    return Response.json({ error: "Failed to fetch coupons." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_coupons_post", limit: 40, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = couponCreateSchema.parse(await request.json());
    const ref = adminDb.collection("coupons").doc(body.code.toUpperCase());
    await ref.set({
      id: ref.id,
      code: body.code.toUpperCase(),
      active: true,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minOrderAmount: body.minOrderAmount,
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
