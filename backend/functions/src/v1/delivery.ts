import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import {
  COLLECTIONS,
  assertRole,
  createTimestamp,
  db,
  deliveryStatusSchema,
  syncDeliveryTrackingDoc,
  syncOrderFeedDoc,
  withCallableGuard
} from "./common";
import { assertValidTransition, type OrderLifecycleStatus } from "../orderStatusLifecycle";

const updateDeliveryStatusSchema = z.object({
  deliveryId: z.string().min(1),
  status: deliveryStatusSchema
});

const updateTrackingSchema = z.object({
  deliveryId: z.string().min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  })
});

const updateAssignmentTrackingSchema = z.object({
  assignmentId: z.string().min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  })
});

export const updateDeliveryStatusV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["delivery_boy", "manager", "admin"]);
    const deliveryRef = db.collection(COLLECTIONS.delivery).doc(payload.deliveryId);
    const snap = await deliveryRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Delivery record not found.");
    }
    const delivery = snap.data() as { orderId: string; deliveryPartnerId: string; status?: string };
    if (ctx.role === "delivery_boy" && delivery.deliveryPartnerId !== ctx.uid) {
      throw new HttpsError("permission-denied", "Delivery partner mismatch.");
    }
    const now = createTimestamp();
    await deliveryRef.update({
      status: payload.status,
      updatedAt: now
    });
    const mappedOrderStatus = mapDeliveryStatusToOrderStatus(payload.status);
    const orderRef = db.collection(COLLECTIONS.orders).doc(delivery.orderId);
    if (mappedOrderStatus) {
      const orderSnap = await orderRef.get();
      const prev = (orderSnap.data() as { status?: string } | undefined)?.status;
      try {
        assertValidTransition(prev, mappedOrderStatus);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new HttpsError("failed-precondition", msg);
      }
      await orderRef.update({
        status: mappedOrderStatus,
        updatedAt: now
      });
    }
    await syncDeliveryTrackingDoc(delivery.orderId, {
      status: payload.status,
      updatedAt: now
    });
    let feedStatus: string;
    if (mappedOrderStatus) {
      feedStatus = mappedOrderStatus;
    } else {
      const os = await orderRef.get();
      feedStatus = String(os.data()?.status ?? "pending");
    }
    await syncOrderFeedDoc(delivery.orderId, {
      status: feedStatus,
      updatedAt: now
    });
    return { success: true };
  },
  updateDeliveryStatusSchema
);

export const updateDeliveryTrackingV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["delivery_boy", "manager", "admin"]);
    const deliveryRef = db.collection(COLLECTIONS.delivery).doc(payload.deliveryId);
    const snap = await deliveryRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Delivery record not found.");
    }
    const delivery = snap.data() as { orderId: string; deliveryPartnerId: string };
    if (ctx.role === "delivery_boy" && delivery.deliveryPartnerId !== ctx.uid) {
      throw new HttpsError("permission-denied", "Delivery partner mismatch.");
    }
    const now = createTimestamp();
    await deliveryRef.set(
      {
        location: payload.location,
        updatedAt: now
      },
      { merge: true }
    );
    await syncDeliveryTrackingDoc(delivery.orderId, {
      location: payload.location,
      updatedAt: now
    });
    return { success: true };
  },
  updateTrackingSchema
);

// Location updates for the "nearest delivery boy" flow which stores assignment state
// under the legacy `delivery_assignments` collection and writes to RTDB `deliveryTracking/{orderId}`.
export const updateDeliveryAssignmentTrackingV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["delivery_boy", "manager", "admin"]);

    const assignmentRef = db.collection("delivery_assignments").doc(payload.assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
      throw new HttpsError("not-found", "Delivery assignment not found.");
    }

    const assignment = assignmentSnap.data() as { orderId?: string; deliveryBoyId?: string };
    if (!assignment.orderId) {
      throw new HttpsError("internal", "Missing orderId on delivery assignment.");
    }
    if (ctx.role === "delivery_boy" && assignment.deliveryBoyId !== ctx.uid) {
      throw new HttpsError("permission-denied", "Delivery partner mismatch.");
    }

    const now = createTimestamp();
    await assignmentRef.set(
      {
        location: payload.location,
        updatedAt: now
      },
      { merge: true }
    );

    await syncDeliveryTrackingDoc(assignment.orderId, {
      location: payload.location,
      updatedAt: now
    });

    return { success: true };
  },
  updateAssignmentTrackingSchema
);

/**
 * `assigned` does not change `orders.status` (order should already be `ready`).
 * Other statuses map to the next lifecycle step.
 */
function mapDeliveryStatusToOrderStatus(
  status: z.infer<typeof deliveryStatusSchema>
): OrderLifecycleStatus | null {
  if (status === "assigned") return null;
  if (status === "picked_up" || status === "on_the_way") return "out_for_delivery";
  if (status === "delivered") return "delivered";
  return null;
}
