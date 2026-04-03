import { adminDb } from "@shared/firebase/admin";

/** Avoid composite-index requirement (active + range on expiryAt + orderBy). */
export const dynamic = "force-dynamic";

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
    const nowIso = new Date().toISOString();
    const snap = await adminDb.collection("coupons").where("active", "==", true).limit(200).get();

    const offers = snap.docs
      .map((doc) => doc.data() as Partial<CouponRecord>)
      .filter((coupon) => typeof coupon.code === "string" && typeof coupon.discountValue === "number")
      .filter((coupon) => {
        const exp = coupon.expiryAt;
        return typeof exp === "string" && exp >= nowIso;
      })
      .sort((a, b) => String(a.expiryAt).localeCompare(String(b.expiryAt)))
      .slice(0, 20)
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
