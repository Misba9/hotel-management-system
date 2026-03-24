import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import {
  COLLECTIONS,
  OrderStatus,
  assertRole,
  createTimestamp,
  db,
  deliveryStatusSchema,
  rtdb,
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
    await rtdb.ref(`deliveryTracking/${delivery.orderId}`).update({
      status: payload.status,
      updatedAt: now
    });
    await rtdb.ref(`orderFeeds/${delivery.orderId}`).update({
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
    await rtdb.ref(`deliveryTracking/${delivery.orderId}`).update({
      location: payload.location,
      updatedAt: now
    });
    return { success: true };
  },
  updateTrackingSchema
);

function mapDeliveryStatusToOrderStatus(status: z.infer<typeof deliveryStatusSchema>): OrderStatus {
  if (status === "assigned") return "ready";
  if (status === "picked_up" || status === "on_the_way") return "out_for_delivery";
  if (status === "delivered") return "delivered";
  return "confirmed";
}
