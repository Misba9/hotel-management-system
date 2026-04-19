import Razorpay from "razorpay";
import { adminAuth } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
import {
  amountInPaise,
  computeStorefrontOrderTotal,
  persistStorefrontOrder,
  verifyRazorpayPaymentSignature
} from "@/lib/server/persist-storefront-order";

export const dynamic = "force-dynamic";

const deliveryAddressSchema = z.object({
  id: z.string().min(1),
  label: z.enum(["Home", "Work", "Other"]),
  name: z.string().min(1).max(120),
  phone: z.string().min(8).max(20),
  addressLine: z.string().min(1).max(400),
  landmark: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  pincode: z.string().regex(/^\d{6}$/),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional()
});

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        price: z.number().nonnegative().optional(),
        quantity: z.number().int().positive()
      })
    )
    .min(1),
  couponCode: z.string().max(40).optional(),
  orderType: z.enum(["delivery", "pickup", "dine_in"]).optional(),
  address: z.string().min(5).max(500),
  deliveryAddress: deliveryAddressSchema.optional()
});

async function verifyCustomerUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * POST — Verify Razorpay HMAC signature + payment amount, then persist Firestore order (`paymentStatus: "paid"`).
 * Public URL alias: `POST /api/verify-payment`
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "razorpay_verify", limit: 40, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId?.trim() || !keySecret?.trim()) {
    return Response.json(
      {
        success: false,
        error: "Razorpay is not configured on the server.",
        code: "RAZORPAY_NOT_CONFIGURED"
      },
      { status: 503 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const uid = await verifyCustomerUid(request);
    if (!uid) {
      return Response.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const okSig = verifyRazorpayPaymentSignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
      keySecret
    );
    if (!okSig) {
      return Response.json({ success: false, error: "Invalid payment signature." }, { status: 400 });
    }

    const storefrontBody = {
      customerName: body.customerName,
      phone: body.phone,
      items: body.items,
      couponCode: body.couponCode,
      orderType: body.orderType,
      address: body.address,
      ...(body.deliveryAddress ? { deliveryAddress: body.deliveryAddress } : {})
    };

    const computed = await computeStorefrontOrderTotal(storefrontBody);
    if (!computed.ok) {
      return Response.json({ success: false, error: computed.error }, { status: computed.status });
    }

    const expectedPaise = amountInPaise(computed.data.totalAmount);

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const payment = await razorpay.payments.fetch(body.razorpay_payment_id);

    if (payment.order_id && payment.order_id !== body.razorpay_order_id) {
      return Response.json({ success: false, error: "Payment does not match this checkout." }, { status: 400 });
    }

    const paidPaise = Number(payment.amount);
    if (!Number.isFinite(paidPaise) || paidPaise !== expectedPaise) {
      return Response.json({ success: false, error: "Payment amount does not match order total." }, { status: 400 });
    }

    if (payment.status !== "captured" && payment.status !== "authorized") {
      return Response.json(
        { success: false, error: `Payment not successful (status: ${payment.status}).` },
        { status: 400 }
      );
    }

    const result = await persistStorefrontOrder({
      userId: uid,
      body: storefrontBody,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      razorpay: { orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id }
    });

    return Response.json({
      success: true,
      message: "Order placed successfully.",
      orderId: result.orderId,
      totalAmount: result.totalAmount,
      ...(result.trackingToken ? { trackingToken: result.trackingToken } : {})
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: "Invalid payload.", details: error.issues },
        { status: 400 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[razorpay/verify]", error);
    }
    return Response.json({ success: false, error: "Could not verify payment or save order." }, { status: 500 });
  }
}
