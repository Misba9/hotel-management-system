/**
 * Normalizes Firestore `coupons` documents for storefront pricing.
 * Supports:
 * - discountType: percentage | percent | fixed | flat
 * - value | discountValue
 * - minOrder | minOrderAmount
 */

export type CouponEvalResult =
  | { ok: true; discount: number }
  | { ok: false; error: string };

export function evaluateCouponDiscount(coupon: Record<string, unknown>, subtotal: number): CouponEvalResult {
  if (coupon.active !== true) {
    return { ok: false, error: "Coupon expired or inactive." };
  }

  const expiryRaw = coupon.expiryAt;
  if (expiryRaw != null && String(expiryRaw).trim() !== "") {
    const exp = new Date(String(expiryRaw));
    if (Number.isNaN(exp.getTime()) || exp < new Date()) {
      return { ok: false, error: "Coupon expired or inactive." };
    }
  }

  const usageLimit = coupon.usageLimit;
  if (typeof usageLimit === "number" && usageLimit > 0) {
    const used = Number(coupon.usedCount ?? 0);
    if (used >= usageLimit) {
      return { ok: false, error: "Coupon usage limit reached." };
    }
  }

  const minOrder = Math.max(0, Number(coupon.minOrder ?? coupon.minOrderAmount ?? 0));
  if (!Number.isFinite(subtotal) || subtotal < minOrder) {
    return { ok: false, error: "Minimum order amount not met for this coupon." };
  }

  const typeRaw = String(coupon.discountType ?? "").toLowerCase();
  const isFixed = typeRaw === "fixed" || typeRaw === "flat";
  const isPercent = typeRaw === "percentage" || typeRaw === "percent";
  if (!isFixed && !isPercent) {
    return { ok: false, error: "Invalid coupon configuration." };
  }

  const value = Number(coupon.value ?? coupon.discountValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Invalid coupon configuration." };
  }

  const rawDiscount = isFixed ? Math.floor(value) : Math.floor((subtotal * value) / 100);
  const capped = Math.min(Math.max(rawDiscount, 0), subtotal);
  return { ok: true, discount: capped };
}
