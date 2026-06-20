import { doc, getDoc } from "firebase/firestore";
import { evaluateCouponDiscount } from "@shared/utils/coupon-eval";
import { getStaffDb } from "@/lib/firebase";

export type CouponApplyResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: string };

export async function validateCouponCode(code: string, subtotal: number): Promise<CouponApplyResult> {
  const raw = code.trim().toUpperCase();
  if (!raw) return { ok: false, error: "Enter a coupon code." };
  const db = getStaffDb();
  if (!db) return { ok: false, error: "Offline — coupon lookup requires cloud connection." };
  const snap = await getDoc(doc(db, "coupons", raw));
  if (!snap.exists()) {
    const q = await getDoc(doc(db, "coupons", code.trim()));
    if (!q.exists()) return { ok: false, error: "Invalid coupon code." };
    const result = evaluateCouponDiscount(q.data() as Record<string, unknown>, subtotal);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, code: code.trim(), discount: result.discount };
  }
  const result = evaluateCouponDiscount(snap.data() as Record<string, unknown>, subtotal);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, code: raw, discount: result.discount };
}
