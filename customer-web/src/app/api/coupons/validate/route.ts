import { NextResponse } from "next/server";
import { adminDb } from "@shared/firebase/admin";
import { evaluateCouponDiscount } from "@shared/utils/coupon-eval";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const couponValidateSchema = z.object({
  code: z.string().min(2).max(40),
  subtotal: z.number().nonnegative()
});

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "customer_coupon_validate", limit: 40, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  const parsed = couponValidateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Invalid coupon payload." }, { status: 400 });
  }
  const body = parsed.data;
  const code = body.code.trim().toUpperCase();
  const subtotal = Number(body.subtotal ?? 0);

  const snap = await adminDb.collection("coupons").where("code", "==", code).limit(1).get();
  if (snap.empty) {
    return NextResponse.json({ valid: false, message: "Coupon not found." }, { status: 404 });
  }

  const coupon = snap.docs[0].data() as Record<string, unknown>;
  const result = evaluateCouponDiscount(coupon, subtotal);
  if (!result.ok) {
    return NextResponse.json({ valid: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({ valid: true, discount: result.discount });
}
