import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { setOrderFeed } from "@shared/utils/order-feed-firestore";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";
import { resolveServerPricing } from "@shared/utils/server-order-pricing";
import { generateSignedTrackingToken } from "@shared/utils/tracking-token";
import { z } from "zod";

export const dynamic = "force-dynamic";

type CheckoutPayload = {
  userId?: string;
  branchId?: string;
  orderType?: "delivery" | "pickup" | "dine_in";
  paymentMethod?: "upi" | "card" | "cod";
  address?: string;
  customerName?: string;
  customerPhone?: string;
  couponCode?: string;
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
  }>;
};

const checkoutSchema = z.object({
  userId: z.string().optional(),
  branchId: z.string().optional(),
  orderType: z.enum(["delivery", "pickup", "dine_in"]).optional(),
  paymentMethod: z.enum(["upi", "card", "cod"]).optional(),
  address: z.string().max(300).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
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
      address: body.address?.trim() ? body.address.trim() : null,
      customerName: body.customerName?.trim() ? body.customerName.trim() : null,
      customerPhone: body.customerPhone?.trim() ? body.customerPhone.trim() : null,
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
    await setOrderFeed(orderId, {
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
