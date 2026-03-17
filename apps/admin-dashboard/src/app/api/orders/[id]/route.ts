import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const updateOrderSchema = z
  .object({
    status: z.enum(["pending", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]).optional(),
    refund: z.boolean().optional(),
    refundReason: z.string().max(300).optional(),
    deliveryPartnerId: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_orders_patch", limit: 80, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const id = context.params.id;
    const body = updateOrderSchema.parse(await request.json());
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };
    if (body.status) updates.status = body.status;
    if (body.deliveryPartnerId) updates.deliveryPartnerId = body.deliveryPartnerId;

    await adminDb.collection("orders").doc(id).set(updates, { merge: true });

    if (body.refund) {
      const paymentSnap = await adminDb.collection("payments").where("orderId", "==", id).limit(1).get();
      if (!paymentSnap.empty) {
        await paymentSnap.docs[0].ref.set(
          {
            status: "refunded",
            refundReason: body.refundReason ?? "admin_refund",
            refundedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Orders PATCH error:", error);
    }
    return Response.json({ error: "Failed to update order." }, { status: 500 });
  }
}
