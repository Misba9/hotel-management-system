import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { assertValidTransition, type OrderLifecycleStatus } from "@shared/utils/order-status-lifecycle";
import { getAssignedTo } from "@shared/utils/unified-order-doc";
import { updateOrderFeed } from "@shared/utils/order-feed-firestore";
import {
  orderStatusesEffectivelyEqual,
  validateOrderStatusUpdate
} from "@shared/utils/order-update-validation";
import { z } from "zod";

/** Admin/manager force-set `orders.status` (bypasses linear lifecycle checks). */
const OVERRIDE_STATUSES = [
  "PLACED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
  "CANCELED",
  "REJECTED",
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "rejected",
  "canceled"
] as const;

const OVERRIDE_STATUS_SET = new Set<string>(OVERRIDE_STATUSES);

function applyStatusBucketForOverride(updates: Record<string, unknown>, statusRaw: string): void {
  const u = statusRaw.toUpperCase();
  const l = statusRaw.toLowerCase();
  if (u === "COMPLETED" || l === "delivered" || l === "completed") {
    updates.statusBucket = "completed";
  }
  if (
    u === "CANCELLED" ||
    u === "CANCELED" ||
    u === "REJECTED" ||
    l === "cancelled" ||
    l === "canceled" ||
    l === "rejected"
  ) {
    updates.statusBucket = "completed";
  }
}

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
    /** Bypasses {@link assertValidTransition}; use for manager overrides and dine-in statuses. */
    overrideStatus: z.string().min(1).max(40).optional(),
    refund: z.boolean().optional(),
    refundReason: z.string().max(300).optional(),
    deliveryPartnerId: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." })
  .refine((value) => !(value.status && value.overrideStatus), {
    message: "Cannot send both status and overrideStatus."
  });

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
    let statusForFeed: string | undefined;

    if (body.overrideStatus) {
      const raw = body.overrideStatus.trim();
      if (!OVERRIDE_STATUS_SET.has(raw)) {
        return Response.json({ error: "Invalid overrideStatus." }, { status: 400 });
      }
      const prev = existing.data() as Record<string, unknown> | undefined;
      const currentStatus = String(prev?.status ?? "");
      const orderType = String(prev?.orderType ?? "");
      if (!orderStatusesEffectivelyEqual(currentStatus, raw)) {
        const step = validateOrderStatusUpdate({ orderType, currentStatus, nextStatus: raw });
        if (!step.ok) {
          return Response.json({ error: step.message, code: step.code }, { status: 400 });
        }
      }
      updates.status = raw;
      applyStatusBucketForOverride(updates, raw);
      statusForFeed = raw;
    } else if (body.status) {
      if (body.status !== "cancelled" && body.status !== "rejected") {
        try {
          assertValidTransition(existing.data()?.status as string | undefined, body.status as OrderLifecycleStatus);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 400 });
        }
      }
      updates.status = body.status;
      statusForFeed = body.status;
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

    if (statusForFeed) {
      await updateOrderFeed(id, {
        status: statusForFeed,
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
