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

function normalizeOfferCoupon(raw: Partial<CouponRecord> & Record<string, unknown>): CouponRecord | null {
  if (typeof raw.code !== "string") return null;
  const value = Number(raw.discountValue ?? raw.value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const typeRaw = String(raw.discountType ?? "").toLowerCase();
  const discountType: "flat" | "percent" =
    typeRaw === "flat" || typeRaw === "fixed" ? "flat" : "percent";
  return {
    code: raw.code,
    discountType,
    discountValue: value,
    minOrderAmount: Math.max(0, Number(raw.minOrderAmount ?? raw.minOrder ?? 0)),
    expiryAt: String(raw.expiryAt ?? "")
  };
}

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
      .map((doc) => doc.data() as Partial<CouponRecord> & Record<string, unknown>)
      .map((c) => normalizeOfferCoupon(c))
      .filter((c): c is CouponRecord => Boolean(c))
      .filter((coupon) => {
        const exp = coupon.expiryAt;
        return typeof exp === "string" && exp >= nowIso;
      })
      .sort((a, b) => String(a.expiryAt).localeCompare(String(b.expiryAt)))
      .slice(0, 20)
      .map((normalized) => ({
        code: normalized.code,
        title: formatOfferTitle(normalized),
        expiresAt: normalized.expiryAt
      }));

    return Response.json({ success: true, offers }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch offers.", error);
    return Response.json({ success: false, error: "Failed to fetch offers." }, { status: 500 });
  }
}
