import { adminAuth } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { persistStorefrontOrder } from "@/lib/server/persist-storefront-order";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createOrderSchema = z.object({
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
  /** Full delivery address string (required for storefront checkout). */
  address: z.string().min(5).max(500),
  paymentMethod: z.enum(["cod"]).default("cod")
});

async function tryVerifyCustomerUid(request: Request): Promise<string | null> {
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
 * POST — Create an order in Firestore `orders` (Admin SDK).
 * COD: paymentStatus `pending` until cash is collected on delivery.
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "orders_create", limit: 20, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const body = createOrderSchema.parse(await request.json());
    const customerUid = await tryVerifyCustomerUid(request);
    if (!customerUid) {
      return Response.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const result = await persistStorefrontOrder({
      userId: customerUid,
      body: {
        customerName: body.customerName,
        phone: body.phone,
        items: body.items,
        couponCode: body.couponCode,
        orderType: body.orderType,
        address: body.address
      },
      paymentMethod: "cod",
      paymentStatus: "pending"
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
        { success: false, error: "Invalid order payload.", details: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Could not create order.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not found") || lower.includes("mismatch") || lower.includes("not available")
        ? 400
        : 500;
    if (process.env.NODE_ENV !== "production") {
      console.error("Create order error:", error);
    }
    return Response.json({ success: false, error: message }, { status });
  }
}
