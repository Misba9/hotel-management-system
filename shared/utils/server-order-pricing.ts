import { adminDb } from "@shared/firebase/admin";

const SETTINGS_DOC = "business";
export const DEFAULT_TAX_PERCENT = 5;

export type PricedOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type PricingResolution =
  | {
      items: PricedOrderItem[];
      subtotal: number;
      discount: number;
      taxPercent: number;
      taxAmount: number;
    }
  | {
      status: number;
      error: string;
    };

export async function getMenuItemById(
  id: string
): Promise<{ name: string; price: number; available: boolean } | null> {
  const dbSnap = await adminDb.collection("products").doc(id).get();
  if (dbSnap.exists) {
    const data = dbSnap.data() as { name?: string; price?: number; available?: boolean };
    if (typeof data.price !== "number" || !data.name) return null;
    return {
      name: data.name,
      price: data.price,
      available: data.available !== false
    };
  }
  return null;
}

export async function resolveTaxPercent(): Promise<number> {
  try {
    const snap = await adminDb.collection("settings").doc(SETTINGS_DOC).get();
    if (!snap.exists) return DEFAULT_TAX_PERCENT;
    const raw = Number((snap.data() as { taxPercent?: number }).taxPercent ?? DEFAULT_TAX_PERCENT);
    if (!Number.isFinite(raw) || raw < 0) return DEFAULT_TAX_PERCENT;
    return raw;
  } catch {
    return DEFAULT_TAX_PERCENT;
  }
}

export async function resolveDiscountAmount(
  couponCode: string | undefined,
  subtotal: number
): Promise<{ ok: true; discount: number } | { ok: false; error: string }> {
  if (!couponCode) return { ok: true, discount: 0 };
  const code = couponCode.trim().toUpperCase();
  if (!code) return { ok: true, discount: 0 };

  const snap = await adminDb.collection("coupons").where("code", "==", code).limit(1).get();
  if (snap.empty) {
    return { ok: false, error: "Coupon not found." };
  }

  const coupon = snap.docs[0].data() as {
    active?: boolean;
    minOrderAmount?: number;
    expiryAt?: string;
    usageLimit?: number;
    usedCount?: number;
    discountType?: "flat" | "percent";
    discountValue?: number;
  };

  const isExpired = coupon.expiryAt ? new Date(coupon.expiryAt) < new Date() : true;
  if (!coupon.active || isExpired) return { ok: false, error: "Coupon expired or inactive." };
  if (Number(coupon.usedCount ?? 0) >= Number(coupon.usageLimit ?? 0))
    return { ok: false, error: "Coupon usage limit reached." };
  if (subtotal < Number(coupon.minOrderAmount ?? 0)) return { ok: false, error: "Minimum amount not met for coupon." };

  const rawDiscount =
    coupon.discountType === "flat"
      ? Number(coupon.discountValue ?? 0)
      : Math.floor((subtotal * Number(coupon.discountValue ?? 0)) / 100);

  return { ok: true, discount: Math.min(Math.max(rawDiscount, 0), subtotal) };
}

export async function resolveServerPricing(
  requestedItems: Array<{ id: string; name?: string; price?: number; quantity: number }>,
  couponCode?: string
): Promise<PricingResolution> {
  const pricedItems: PricedOrderItem[] = [];

  for (const requested of requestedItems) {
    const menuEntry = await getMenuItemById(requested.id);
    if (!menuEntry) {
      return { status: 404, error: `Product not found: ${requested.id}` };
    }
    if (menuEntry.available === false) {
      return { status: 400, error: `Product is not available: ${requested.id}` };
    }

    if (requested.price !== undefined && Number(requested.price) !== Number(menuEntry.price)) {
      return { status: 400, error: `Price mismatch detected for ${requested.id}.` };
    }

    pricedItems.push({
      id: requested.id,
      name: menuEntry.name,
      price: Number(menuEntry.price),
      quantity: Number(requested.quantity)
    });
  }

  const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountResult = await resolveDiscountAmount(couponCode, subtotal);
  if (!discountResult.ok) {
    return { status: 400, error: discountResult.error };
  }
  const discount = discountResult.discount;
  const taxPercent = await resolveTaxPercent();
  const taxableAmount = Math.max(subtotal - discount, 0);
  const taxAmount = Math.floor((taxableAmount * taxPercent) / 100);

  return {
    items: pricedItems,
    subtotal,
    discount,
    taxPercent,
    taxAmount
  };
}
