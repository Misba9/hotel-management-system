import { adminDb } from "@shared/firebase/admin";

type CouponRecord = {
  code: string;
  discountType: "flat" | "percent";
  discountValue: number;
  minOrderAmount: number;
  expiryAt: string;
};

function formatOfferTitle(coupon: CouponRecord): string {
  const discountLabel =
    coupon.discountType === "percent" ? `${coupon.discountValue}% off` : `Rs. ${coupon.discountValue} off`;
  const minOrderLabel = coupon.minOrderAmount > 0 ? ` on orders above Rs. ${coupon.minOrderAmount}` : "";
  return `${discountLabel}${minOrderLabel}`;
}

export async function GET() {
  try {
    const now = new Date();
    const snap = await adminDb
      .collection("coupons")
      .where("active", "==", true)
      .where("expiryAt", ">=", now.toISOString())
      .orderBy("expiryAt", "asc")
      .limit(20)
      .get();

    const offers = snap.docs
      .map((doc) => doc.data() as Partial<CouponRecord>)
      .filter((coupon) => typeof coupon.code === "string" && typeof coupon.discountValue === "number")
      .map((coupon) => {
        const normalized: CouponRecord = {
          code: coupon.code!,
          discountType: coupon.discountType === "flat" ? "flat" : "percent",
          discountValue: Number(coupon.discountValue ?? 0),
          minOrderAmount: Number(coupon.minOrderAmount ?? 0),
          expiryAt: String(coupon.expiryAt ?? "")
        };
        return {
          code: normalized.code,
          title: formatOfferTitle(normalized),
          expiresAt: normalized.expiryAt
        };
      });

    return Response.json({ success: true, offers }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch offers.", error);
    return Response.json({ success: false, error: "Failed to fetch offers." }, { status: 500 });
  }
}
