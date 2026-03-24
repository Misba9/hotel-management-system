import { NextResponse } from "next/server";
import { adminDb } from "@shared/firebase/admin";
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

  const coupon = snap.docs[0].data() as {
    active: boolean;
    minOrderAmount: number;
    expiryAt: string;
    usageLimit: number;
    usedCount: number;
    discountType: "flat" | "percent";
    discountValue: number;
  };

  if (!coupon.active || new Date(coupon.expiryAt) < new Date()) {
    return NextResponse.json({ valid: false, message: "Coupon expired or inactive." }, { status: 400 });
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    return NextResponse.json({ valid: false, message: "Usage limit reached." }, { status: 400 });
  }
  if (subtotal < coupon.minOrderAmount) {
    return NextResponse.json({ valid: false, message: "Minimum amount not met." }, { status: 400 });
  }

  const discount =
    coupon.discountType === "flat" ? coupon.discountValue : Math.floor((subtotal * coupon.discountValue) / 100);
  return NextResponse.json({ valid: true, discount });
}
