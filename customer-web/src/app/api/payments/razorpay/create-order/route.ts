import Razorpay from "razorpay";
import { adminAuth } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
import { amountInPaise, computeStorefrontOrderTotal } from "@/lib/server/persist-storefront-order";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
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
  /** Optional: client total in INR; must match server pricing when set. */
  amount: z.number().nonnegative().optional()
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
 * POST — Create a Razorpay Order (server). Amount matches server-side pricing for the cart.
 * Frontend uses returned ids with Razorpay Checkout, then calls /api/payments/razorpay/verify.
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "razorpay_create_order", limit: 30, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return Response.json(
      { success: false, error: "Razorpay is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const uid = await verifyCustomerUid(request);
    if (!uid) {
      return Response.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const computed = await computeStorefrontOrderTotal({
      customerName: body.customerName,
      phone: body.phone,
      items: body.items,
      couponCode: body.couponCode,
      orderType: body.orderType,
      address: body.address
    });

    if (!computed.ok) {
      return Response.json({ success: false, error: computed.error }, { status: computed.status });
    }

    const { totalAmount } = computed.data;
    if (body.amount !== undefined && Number.isFinite(body.amount)) {
      const serverPaise = Math.round(totalAmount * 100);
      const clientPaise = Math.round(body.amount * 100);
      if (Math.abs(serverPaise - clientPaise) > 1) {
        return Response.json(
          {
            success: false,
            error: "Order total changed. Refresh checkout and try again."
          },
          { status: 409 }
        );
      }
    }

    const amountPaise = amountInPaise(totalAmount);

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const receipt = `fh_${uid.slice(0, 8)}_${Date.now()}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: uid,
        source: "customer-web"
      }
    });

    return Response.json({
      success: true,
      razorpayOrderId: order.id,
      amount: amountPaise,
      currency: order.currency ?? "INR",
      keyId
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: "Invalid payload.", details: error.issues },
        { status: 400 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[razorpay/create-order]", error);
    }
    return Response.json({ success: false, error: "Could not create payment order." }, { status: 500 });
  }
}
