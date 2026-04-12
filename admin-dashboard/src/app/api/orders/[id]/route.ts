import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { getAssignedTo } from "@shared/utils/unified-order-doc";
import { updateOrderFeed } from "@shared/utils/order-feed-firestore";
import { z } from "zod";

const updateOrderSchema = z
  .object({
    status: z
      .enum([
        "pending",
        "accepted",
        "rejected",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ])
      .optional(),
    refund: z.boolean().optional(),
    refundReason: z.string().max(300).optional(),
    deliveryPartnerId: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_orders_patch", limit: 80, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const id = context.params.id;
    const orderRef = adminDb.collection("orders").doc(id);
    const existing = await orderRef.get();
    if (!existing.exists) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const body = updateOrderSchema.parse(await request.json());
    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updatedAt: nowIso
    };
    if (body.status) {
      updates.status = body.status;
      if (body.status === "delivered") {
        updates.statusBucket = "completed";
      }
      if (body.status === "rejected" || body.status === "cancelled") {
        updates.statusBucket = "completed";
      }
    }
    if (body.deliveryPartnerId) {
      updates.deliveryPartnerId = body.deliveryPartnerId;
      const prev = existing.data();
      const at = getAssignedTo(prev as { assignedTo?: unknown });
      updates.assignedTo = {
        kitchenId: at.kitchenId,
        deliveryId: body.deliveryPartnerId
      };
    }

    await orderRef.set(updates, { merge: true });

    if (body.status) {
      await updateOrderFeed(id, {
        status: body.status,
        updatedAt: nowIso
      });
    }

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
