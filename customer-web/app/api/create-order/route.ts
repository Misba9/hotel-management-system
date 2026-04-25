import Razorpay from "razorpay";
import { adminAuth } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
import { amountInPaise, computeStorefrontOrderTotal } from "@/lib/server/persist-storefront-order";

export const dynamic = "force-dynamic";

const deliveryAddressSchema = z
  .object({
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
  })
  .optional();

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
  deliveryAddress: deliveryAddressSchema,
  /** Optional hint from client (INR). Never trusted for charging — only used to detect drift vs server. */
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
 * POST /api/create-order
 * Totals come from Firestore `products` + coupons + tax + delivery (see computeStorefrontOrderTotal).
 * Razorpay order amount is always server-calculated (paise).
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "razorpay_create_order", limit: 30, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
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

    const computed = await computeStorefrontOrderTotal({
      customerName: body.customerName,
      phone: body.phone,
      items: body.items,
      couponCode: body.couponCode,
      orderType: body.orderType,
      address: body.address,
      ...(body.deliveryAddress ? { deliveryAddress: body.deliveryAddress } : {})
    });

    if (!computed.ok) {
      return Response.json({ success: false, error: computed.error }, { status: computed.status });
    }

    const { totalAmount, items: pricedItems, subtotal, discount, taxAmount, deliveryFee } = computed.data;

    const clientAmount = body.amount;
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/create-order] pricing", {
        clientAmountInr: clientAmount,
        serverTotalInr: totalAmount,
        subtotal,
        discount,
        taxAmount,
        deliveryFee,
        lineItems: pricedItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity }))
      });
    }

    if (clientAmount !== undefined && Number.isFinite(clientAmount)) {
      const serverPaise = Math.round(totalAmount * 100);
      const clientPaise = Math.round(clientAmount * 100);
      if (Math.abs(serverPaise - clientPaise) > 1) {
        return Response.json(
          {
            success: false,
            correctTotal: totalAmount,
            recalculatedTotal: totalAmount,
            message: "Price updated"
          },
          { status: 200 }
        );
      }
    }

    const amountPaise = amountInPaise(totalAmount);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      return Response.json(
        {
          success: false,
          error: "Order total must be at least ₹1.00 for online payment. Add items or check pricing."
        },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const receipt = `fh_${uid.slice(0, 8)}_${Date.now()}`.slice(0, 40);

    let order: { id: string; currency?: string };
    try {
      order = await razorpay.orders.create({
        amount: Math.round(amountPaise),
        currency: "INR",
        receipt,
        notes: {
          userId: uid,
          source: "customer-web"
        }
      });
    } catch (rzErr: unknown) {
      const desc = extractRazorpayApiErrorDescription(rzErr);
      if (process.env.NODE_ENV !== "production") {
        console.error("[api/create-order] Razorpay orders.create failed:", rzErr);
      }
      const lower = desc.toLowerCase();
      const authIssue =
        lower.includes("authentication") || lower.includes("invalid key") || lower.includes("wrong key");
      return Response.json(
        {
          success: false,
          error: authIssue
            ? "Razorpay rejected the request. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (same mode: test vs live)."
            : desc || "Could not create Razorpay order."
        },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      id: order.id,
      orderId: order.id,
      razorpayOrderId: order.id,
      amount: amountPaise,
      recalculatedTotal: totalAmount,
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
      console.error("[api/create-order]", error);
    }
    const message = error instanceof Error ? error.message : "Could not create payment order.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

function extractRazorpayApiErrorDescription(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const inner = o.error;
    if (inner && typeof inner === "object") {
      const d = (inner as { description?: unknown }).description;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
    if (typeof o.description === "string" && o.description.trim()) return o.description.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "";
}
