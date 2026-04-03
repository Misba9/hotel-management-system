import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { setOrderFeed } from "@shared/utils/order-feed-rtdb";
import { resolveServerPricing } from "@shared/utils/server-order-pricing";
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
  /** Used only to compute `totalAmount` server-side; not stored on the order. */
  couponCode: z.string().max(40).optional(),
  /** Delivery fee Rs. 40 unless pickup / dine-in. */
  orderType: z.enum(["delivery", "pickup", "dine_in"]).optional(),
  /** Optional delivery address from checkout (stored when provided). */
  address: z.string().max(300).optional()
});

/**
 * POST — Create an order in Firestore `orders` with:
 * customerName, phone, items[], totalAmount, status: pending, createdAt
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "orders_create", limit: 20, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const body = createOrderSchema.parse(await request.json());

    const pricing = await resolveServerPricing(body.items, body.couponCode);
    if ("error" in pricing) {
      return Response.json({ success: false, error: pricing.error }, { status: pricing.status });
    }

    const { items, subtotal, discount, taxAmount } = pricing;
    const deliveryFee =
      body.orderType === "pickup" || body.orderType === "dine_in" ? 0 : 40;
    const totalAmount = Math.max(subtotal - discount, 0) + taxAmount + deliveryFee;

    const orderDoc: Record<string, unknown> = {
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      })),
      totalAmount,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    };

    const trimmedAddress = body.address?.trim();
    if (trimmedAddress) {
      orderDoc.address = trimmedAddress;
    }

    const docRef = await adminDb.collection("orders").add(orderDoc);

    const createdAtIso = new Date().toISOString();
    await setOrderFeed(docRef.id, {
      status: "pending",
      updatedAt: createdAtIso,
      createdAt: createdAtIso,
      orderType: body.orderType ?? "delivery",
      total: totalAmount
    });

    return Response.json({
      success: true,
      message: "Order placed successfully.",
      orderId: docRef.id,
      totalAmount
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: "Invalid order payload.", details: error.issues },
        { status: 400 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Create order error:", error);
    }
    return Response.json({ success: false, error: "Could not create order." }, { status: 500 });
  }
}
