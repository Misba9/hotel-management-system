import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const couponUpdateSchema = z
  .object({
    active: z.boolean().optional(),
    usageLimit: z.number().int().positive().optional(),
    expiryAt: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "expiryAt must be a valid date string."
      })
      .optional(),
    discountType: z.enum(["flat", "percent"]).optional(),
    discountValue: z.number().positive().optional(),
    minOrderAmount: z.number().min(0).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_coupons_patch", limit: 80, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const id = context.params.id;
    const body = couponUpdateSchema.parse(await request.json());
    await adminDb.collection("coupons").doc(id).set(body, { merge: true });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Coupons PATCH error:", error);
    }
    return Response.json({ error: "Failed to update coupon." }, { status: 500 });
  }
}
