import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

const rtdb = getDatabase();

export async function assertRole(uid: string, roles: string[]) {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const role = String(user.customClaims?.role ?? "");
  if (!roles.includes(role)) {
    throw new HttpsError("permission-denied", "Insufficient role.");
  }
}

export async function setUserRole(uid: string, role: string) {
  const auth = getAuth();
  await auth.setCustomUserClaims(uid, { role });
}

export async function rateLimit(key: string, maxRequests: number, windowSeconds: number) {
  const ref = rtdb.ref(`rateLimits/${key}`);
  const now = Date.now();
  const snapshot = await ref.get();
  const data = (snapshot.val() ?? {}) as { count?: number; firstAt?: number };
  const firstAt = Number(data.firstAt ?? now);
  const count = Number(data.count ?? 0);

  if (now - firstAt > windowSeconds * 1000) {
    await ref.set({ count: 1, firstAt: now });
    return;
  }

  if (count >= maxRequests) {
    throw new HttpsError("resource-exhausted", "Too many requests.");
  }

  await ref.update({ count: count + 1 });
}

export async function withIdempotency(idempotencyKey: string) {
  const ref = rtdb.ref(`idempotency/${idempotencyKey}`);
  const existing = await ref.get();
  if (existing.exists()) {
    throw new HttpsError("already-exists", "Duplicate request.");
  }
  await ref.set({ createdAt: Date.now() });
}

export const placeOrderSchema = z.object({
  branchId: z.string().min(1),
  orderType: z.enum(["delivery", "pickup", "dine_in"]),
  paymentMethod: z.enum(["upi", "card", "cod"]),
  couponCode: z.string().optional(),
  addressId: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        qty: z.number().int().positive()
      })
    )
    .min(1)
});
