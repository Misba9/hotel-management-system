import crypto from "node:crypto";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { COLLECTIONS, assertRole, createTimestamp, db, withCallableGuard } from "./common";

const initPaymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["upi", "online"])
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1)
});

const markCashSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().nonnegative().optional()
});

export const initiateOnlinePaymentV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["customer", "cashier", "manager", "admin"]);
    const orderSnap = await db.collection(COLLECTIONS.orders).doc(payload.orderId).get();
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = orderSnap.data() as { total?: number };
    const total = Number(order.total ?? 0);
    const paymentQuery = await db.collection(COLLECTIONS.payments).where("orderId", "==", payload.orderId).limit(1).get();
    const now = createTimestamp();

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new HttpsError("failed-precondition", "Razorpay credentials are not configured.");
    }
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: total * 100,
        currency: "INR",
        receipt: payload.orderId
      })
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as { id?: string }) : null;
    if (!res.ok || !data?.id) {
      throw new HttpsError("internal", "Failed to initialize payment provider order.");
    }

    if (paymentQuery.empty) {
      const paymentRef = db.collection(COLLECTIONS.payments).doc();
      await paymentRef.set({
        id: paymentRef.id,
        orderId: payload.orderId,
        customerId: ctx.uid,
        method: payload.method,
        amount: total,
        status: "pending",
        razorpayOrderId: data.id,
        createdAt: now,
        updatedAt: now
      });
    } else {
      await paymentQuery.docs[0].ref.set(
        {
          method: payload.method,
          status: "pending",
          razorpayOrderId: data.id,
          updatedAt: now
        },
        { merge: true }
      );
    }
    return {
      success: true,
      razorpayOrderId: data.id
    };
  },
  initPaymentSchema
);

export const verifyOnlinePaymentV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["customer", "cashier", "manager", "admin"]);
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new HttpsError("failed-precondition", "Razorpay secret is not configured.");
    }
    const signedPayload = `${payload.razorpayOrderId}|${payload.razorpayPaymentId}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    if (expectedSignature !== payload.razorpaySignature) {
      throw new HttpsError("invalid-argument", "Invalid payment signature.");
    }
    const paymentSnap = await db.collection(COLLECTIONS.payments).where("orderId", "==", payload.orderId).limit(1).get();
    if (paymentSnap.empty) {
      throw new HttpsError("not-found", "Payment record not found.");
    }
    const now = createTimestamp();
    await paymentSnap.docs[0].ref.update({
      status: "paid",
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      verifiedAt: now,
      updatedAt: now
    });
    await db.collection(COLLECTIONS.orders).doc(payload.orderId).update({
      paymentStatus: "paid",
      updatedAt: now
    });
    return { success: true };
  },
  verifyPaymentSchema
);

export const markCashPaymentV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["cashier", "manager", "admin"]);
    const paymentSnap = await db.collection(COLLECTIONS.payments).where("orderId", "==", payload.orderId).limit(1).get();
    if (paymentSnap.empty) {
      throw new HttpsError("not-found", "Payment record not found.");
    }
    const now = createTimestamp();
    await paymentSnap.docs[0].ref.update({
      method: "cash",
      status: "paid",
      amount: payload.amount ?? paymentSnap.docs[0].data().amount ?? 0,
      verifiedAt: now,
      updatedAt: now
    });
    await db.collection(COLLECTIONS.orders).doc(payload.orderId).update({
      paymentStatus: "paid",
      updatedAt: now
    });
    return { success: true };
  },
  markCashSchema
);
