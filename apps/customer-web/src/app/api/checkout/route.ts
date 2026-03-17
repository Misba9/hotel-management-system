import { adminDb, adminRtdb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { generateSignedTrackingToken } from "@shared/utils/tracking-token";
import { z } from "zod";

type CheckoutPayload = {
  userId?: string;
  branchId?: string;
  orderType?: "delivery" | "pickup" | "dine_in";
  paymentMethod?: "upi" | "card" | "cod";
  address?: string;
  couponCode?: string;
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
  }>;
};

const SETTINGS_DOC = "business";
const DEFAULT_TAX_PERCENT = 5;

const checkoutSchema = z.object({
  userId: z.string().optional(),
  branchId: z.string().optional(),
  orderType: z.enum(["delivery", "pickup", "dine_in"]).optional(),
  paymentMethod: z.enum(["upi", "card", "cod"]).optional(),
  address: z.string().max(300).optional(),
  couponCode: z.string().max(40).optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        price: z.number().nonnegative().optional(),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "customer_checkout", limit: 20, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = checkoutSchema.parse((await request.json()) as CheckoutPayload);
    const requestedItems = body.items;

    const now = new Date();
    const createdAt = now.toISOString();
    const dayKey = createdAt.slice(0, 10);
    const pricing = await resolveServerPricing(requestedItems, body.couponCode);
    if ("error" in pricing) {
      return Response.json({ success: false, error: pricing.error }, { status: pricing.status });
    }

    const { items, subtotal, discount, taxPercent, taxAmount } = pricing;
    const deliveryFee = body.orderType === "delivery" || !body.orderType ? 40 : 0;
    const total = Math.max(subtotal - discount, 0) + taxAmount + deliveryFee;
    const orderId = crypto.randomUUID();
    const trackingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const paymentMethod = body.paymentMethod ?? "cod";
    const requestUser = await resolveRequestUser(request);
    const userId = requestUser.userId;
    const branchId = body.branchId ?? "hyderabad-main";
    const orderType = body.orderType ?? "delivery";

    const orderRef = adminDb.collection("orders").doc(orderId);
    const paymentRef = adminDb.collection("payments").doc(paymentId);
    const batch = adminDb.batch();

    batch.set(orderRef, {
      id: orderId,
      trackingId,
      userId,
      branchId,
      orderType,
      paymentMethod,
      status: "pending",
      statusBucket: "active",
      subtotal,
      discount,
      taxPercent,
      taxAmount,
      deliveryFee,
      total,
      couponCode: body.couponCode ?? null,
      address: body.address ?? null,
      dayKey,
      createdAt,
      updatedAt: createdAt
    });

    items.forEach((item) => {
      const lineRef = adminDb.collection("order_items").doc();
      batch.set(lineRef, {
        id: lineRef.id,
        orderId,
        menuItemId: item.id,
        name: item.name,
        qty: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity
      });
    });

    const paymentDoc: Record<string, unknown> = {
      id: paymentId,
      orderId,
      status: paymentMethod === "cod" ? "pending" : "pending",
      method: paymentMethod,
      amount: total,
      createdAt
    };

    if (paymentMethod !== "cod") {
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpayKeyId || !razorpayKeySecret) {
        return Response.json({ success: false, error: "Razorpay is not configured." }, { status: 500 });
      }

      const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
      const razorRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`
        },
        body: JSON.stringify({
          amount: total * 100,
          currency: "INR",
          receipt: orderId
        })
      });

      const razorText = await razorRes.text();
      const razorData = razorText ? (JSON.parse(razorText) as { id?: string }) : null;
      if (!razorRes.ok || !razorData?.id) {
        return Response.json({ success: false, error: "Failed to initialize Razorpay order." }, { status: 502 });
      }
      paymentDoc.razorpayOrderId = razorData.id;
    }

    batch.set(paymentRef, paymentDoc);
    await batch.commit();
    await adminRtdb.ref(`orderFeeds/${orderId}`).set({
      status: "pending",
      updatedAt: createdAt,
      createdAt,
      orderType,
      total
    });

    return Response.json(
      {
        success: true,
        order: {
          id: orderId,
          items,
          pricing: {
            subtotal,
            discount,
            taxPercent,
            taxAmount,
            deliveryFee,
            total
          },
          total,
          createdAt
        },
        tracking: {
          id: trackingId,
          token: generateSignedTrackingToken(trackingId)
        },
        payment: {
          method: paymentMethod,
          razorpayOrderId: paymentDoc.razorpayOrderId ?? null
        }
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid checkout payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Checkout error:", error);
    }
    return Response.json({ success: false, error: "Checkout failed" }, { status: 500 });
  }
}

type PricedItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type PricingResolution =
  | {
      items: PricedItem[];
      subtotal: number;
      discount: number;
      taxPercent: number;
      taxAmount: number;
    }
  | {
      status: number;
      error: string;
    };

async function resolveServerPricing(
  requestedItems: Array<{ id: string; name?: string; price?: number; quantity: number }>,
  couponCode?: string
): Promise<PricingResolution> {
  const pricedItems: PricedItem[] = [];

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

async function resolveTaxPercent(): Promise<number> {
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

async function resolveDiscountAmount(
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
  if (Number(coupon.usedCount ?? 0) >= Number(coupon.usageLimit ?? 0)) return { ok: false, error: "Coupon usage limit reached." };
  if (subtotal < Number(coupon.minOrderAmount ?? 0)) return { ok: false, error: "Minimum amount not met for coupon." };

  const rawDiscount =
    coupon.discountType === "flat"
      ? Number(coupon.discountValue ?? 0)
      : Math.floor((subtotal * Number(coupon.discountValue ?? 0)) / 100);

  return { ok: true, discount: Math.min(Math.max(rawDiscount, 0), subtotal) };
}

async function getMenuItemById(id: string): Promise<{ name: string; price: number; available: boolean } | null> {
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
