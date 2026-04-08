import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import {
  COLLECTIONS,
  OrderStatus,
  assertRole,
  createTimestamp,
  db,
  deliveryStatusSchema,
  syncDeliveryTrackingDoc,
  syncOrderFeedDoc,
  withCallableGuard
} from "./common";

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
    await db.collection(COLLECTIONS.orders).doc(delivery.orderId).update({
      status: mappedOrderStatus,
      updatedAt: now
    });
    await syncDeliveryTrackingDoc(delivery.orderId, {
      status: payload.status,
      updatedAt: now
    });
    await syncOrderFeedDoc(delivery.orderId, {
      status: mappedOrderStatus,
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

function mapDeliveryStatusToOrderStatus(status: z.infer<typeof deliveryStatusSchema>): OrderStatus {
  if (status === "assigned") return "ready";
  if (status === "picked_up" || status === "on_the_way") return "out_for_delivery";
  if (status === "delivered") return "delivered";
  return "confirmed";
}
