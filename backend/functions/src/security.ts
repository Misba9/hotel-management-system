import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

const db = getFirestore();

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
  const ref = db.collection("rateLimits").doc(key);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = (snapshot.data() ?? {}) as { count?: number; firstAt?: number };
    const firstAt = Number(data.firstAt ?? now);
    const count = Number(data.count ?? 0);

    if (!snapshot.exists || now - firstAt > windowSeconds * 1000) {
      tx.set(ref, { count: 1, firstAt: now });
      return;
    }

    if (count >= maxRequests) {
      throw new HttpsError("resource-exhausted", "Too many requests.");
    }

    tx.update(ref, { count: count + 1 });
  });
}

export async function withIdempotency(idempotencyKey: string) {
  const ref = db.collection("idempotency").doc(idempotencyKey);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      throw new HttpsError("already-exists", "Duplicate request.");
    }
    tx.set(ref, { createdAt: Date.now() });
  });
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
