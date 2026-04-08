import { createHmac, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { setOrderFeed } from "@shared/utils/order-feed-firestore";
import type { PricedOrderItem } from "@shared/utils/server-order-pricing";
import { resolveServerPricing } from "@shared/utils/server-order-pricing";
import { generateSignedTrackingToken } from "@shared/utils/tracking-token";

export type StorefrontOrderBody = {
  customerName: string;
  phone: string;
  items: Array<{ id: string; name?: string; price?: number; quantity: number }>;
  couponCode?: string;
  orderType?: "delivery" | "pickup" | "dine_in";
  address: string;
};

export type ComputedCheckout = {
  items: PricedOrderItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  orderType: "delivery" | "pickup" | "dine_in";
};

export async function computeStorefrontOrderTotal(
  body: StorefrontOrderBody
): Promise<{ ok: true; data: ComputedCheckout } | { ok: false; error: string; status: number }> {
  const orderType = body.orderType ?? "delivery";
  const pricing = await resolveServerPricing(body.items, body.couponCode);
  if ("error" in pricing) {
    return { ok: false, error: pricing.error, status: pricing.status };
  }
  const { items, subtotal, discount, taxAmount } = pricing;
  const deliveryFee = orderType === "pickup" || orderType === "dine_in" ? 0 : 40;
  const totalAmount = Math.round((Math.max(subtotal - discount, 0) + taxAmount + deliveryFee) * 100) / 100;
  return {
    ok: true,
    data: { items, subtotal, discount, taxAmount, deliveryFee, totalAmount, orderType }
  };
}

export function amountInPaise(totalAmount: number): number {
  return Math.round(totalAmount * 100);
}

export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret: string
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(razorpaySignature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function persistStorefrontOrder(args: {
  userId: string;
  body: StorefrontOrderBody;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: "pending" | "paid";
  razorpay?: { orderId: string; paymentId: string };
}): Promise<{ orderId: string; totalAmount: number; trackingToken?: string }> {
  const computed = await computeStorefrontOrderTotal(args.body);
  if (!computed.ok) {
    throw new Error(computed.error);
  }
  const { items, totalAmount, orderType, subtotal, discount, taxAmount, deliveryFee } = computed.data;
  const branchId = process.env.STOREFRONT_BRANCH_ID ?? "hyderabad-main";
  const userSnap = await adminDb.collection("users").doc(args.userId).get();
  const userData = (userSnap.data() ?? {}) as { name?: unknown; phone?: unknown; email?: unknown };

  const orderRef = adminDb.collection("orders").doc();
  const now = FieldValue.serverTimestamp();
  const orderDoc: Record<string, unknown> = {
    id: orderRef.id,
    trackingId: orderRef.id,
    userId: args.userId,
    branchId,
    orderType,
    subtotal,
    discount,
    taxAmount,
    deliveryFee,
    total: totalAmount,
    items: items.map((i) => ({
      productId: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity
    })),
    totalAmount,
    address: args.body.address.trim(),
    status: "pending",
    createdAt: now,
    paymentMethod: args.paymentMethod,
    paymentStatus: args.paymentStatus,
    updatedAt: now
  };

  orderDoc.customerName =
    args.body.customerName.trim() || (typeof userData.name === "string" ? userData.name.trim() : "");
  orderDoc.phone = args.body.phone.trim() || (typeof userData.phone === "string" ? userData.phone.trim() : "");
  if (typeof userData.email === "string" && userData.email.trim()) {
    orderDoc.email = userData.email.trim();
    orderDoc.userEmail = userData.email.trim();
  }

  if (args.razorpay) {
    orderDoc.razorpayOrderId = args.razorpay.orderId;
    orderDoc.razorpayPaymentId = args.razorpay.paymentId;
  }

  await orderRef.set(orderDoc);

  let trackingToken: string | undefined;
  try {
    trackingToken = generateSignedTrackingToken(orderRef.id);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[persistStorefrontOrder] tracking token not issued:", e);
    }
  }

  const createdAtIso = new Date().toISOString();
  await setOrderFeed(orderRef.id, {
    status: "pending",
    updatedAt: createdAtIso,
    createdAt: createdAtIso,
    orderType,
    total: totalAmount
  });

  return { orderId: orderRef.id, totalAmount, ...(trackingToken ? { trackingToken } : {}) };
}
