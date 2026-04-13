import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import {
  COLLECTIONS,
  assertRole,
  createTimestamp,
  db,
  orderLifecycleStatusSchema,
  paymentMethodSchema,
  syncDeliveryTrackingDoc,
  syncOrderFeedDoc,
  withCallableGuard
} from "./common";
import { assignDeliveryAgentWhenOrderReady, DEFAULT_ASSIGNED_TO } from "../autoStaffAssignment";
import { assertValidTransition } from "../orderStatusLifecycle";

const createOrderSchema = z.object({
  branchId: z.string().min(1),
  orderType: z.enum(["delivery", "pickup", "dine_in"]),
  paymentMethod: paymentMethodSchema,
  couponCode: z.string().max(40).optional(),
  notes: z.string().max(300).optional(),
  deliveryAddress: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: orderLifecycleStatusSchema
});

const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(3).max(200).optional()
});

const assignDeliverySchema = z.object({
  orderId: z.string().min(1),
  deliveryPartnerId: z.string().min(1)
});

export const createOrderV1 = withCallableGuard(
  async (payload, ctx) => {
    const productSnaps = await Promise.all(
      payload.items.map((item) => db.collection(COLLECTIONS.products).doc(item.productId).get())
    );
    const missing = productSnaps.findIndex((snap) => !snap.exists);
    if (missing !== -1) {
      throw new HttpsError("not-found", `Product not found: ${payload.items[missing].productId}`);
    }
    const pricedItems = payload.items.map((item, idx) => {
      const data = productSnaps[idx].data() as { id?: string; name?: string; price?: number; available?: boolean };
      if (!data.available) {
        throw new HttpsError("failed-precondition", `Product unavailable: ${item.productId}`);
      }
      return {
        productId: item.productId,
        name: String(data.name ?? "Item"),
        unitPrice: Number(data.price ?? 0),
        quantity: item.quantity
      };
    });
    const subtotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = payload.orderType === "delivery" ? 40 : 0;
    const discount = 0;
    const tax = 0;
    const total = Math.max(0, subtotal - discount + deliveryFee + tax);
    const now = createTimestamp();
    const orderRef = db.collection(COLLECTIONS.orders).doc();
    const paymentRef = db.collection(COLLECTIONS.payments).doc();
    const invoiceRef = db.collection(COLLECTIONS.invoices).doc(orderRef.id);
    const batch = db.batch();

    const lineItems = pricedItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.unitPrice,
      quantity: item.quantity
    }));

    const invoiceLines = pricedItems.map((item) => ({
      id: item.productId,
      name: item.name,
      price: item.unitPrice,
      qty: item.quantity
    }));

    batch.set(orderRef, {
      id: orderRef.id,
      userId: ctx.uid,
      branchId: payload.branchId,
      orderType: payload.orderType,
      paymentMethod: payload.paymentMethod,
      status: "pending",
      notes: payload.notes ?? null,
      couponCode: payload.couponCode ?? null,
      deliveryAddress: payload.deliveryAddress ?? null,
      subtotal,
      discount,
      deliveryFee,
      total,
      invoiceId: orderRef.id,
      items: lineItems,
      assignedTo: { ...DEFAULT_ASSIGNED_TO },
      createdAt: now,
      updatedAt: now
    });

    batch.set(invoiceRef, {
      orderId: orderRef.id,
      invoiceId: orderRef.id,
      userId: ctx.uid,
      items: invoiceLines,
      subtotal,
      tax,
      total,
      createdAt: now,
      source: "callable_v1"
    });

    batch.set(paymentRef, {
      id: paymentRef.id,
      orderId: orderRef.id,
      customerId: ctx.uid,
      method: payload.paymentMethod,
      status: payload.paymentMethod === "cash" ? "pending" : "pending",
      amount: total,
      createdAt: now,
      updatedAt: now
    });
    await batch.commit();

    await syncOrderFeedDoc(orderRef.id, {
      status: "pending",
      total,
      branchId: payload.branchId,
      updatedAt: now
    }, false);

    return {
      success: true,
      orderId: orderRef.id,
      paymentId: paymentRef.id,
      total
    };
  },
  createOrderSchema
);

export const updateOrderStatusV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["kitchen_staff", "waiter", "cashier", "delivery_boy", "manager", "admin"]);
    const orderRef = db.collection(COLLECTIONS.orders).doc(payload.orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const prev = (snap.data() as { status?: string } | undefined)?.status;
    try {
      assertValidTransition(prev, payload.status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpsError("failed-precondition", msg);
    }
    const now = createTimestamp();
    await orderRef.update({
      status: payload.status,
      updatedAt: now
    });
    if (payload.status === "ready") {
      await assignDeliveryAgentWhenOrderReady(db, payload.orderId);
    }
    await syncOrderFeedDoc(payload.orderId, {
      status: payload.status,
      updatedAt: now
    });
    return { success: true };
  },
  updateOrderStatusSchema
);

export const cancelOrderV1 = withCallableGuard(
  async (payload, ctx) => {
    const orderRef = db.collection(COLLECTIONS.orders).doc(payload.orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const order = snap.data() as { customerId?: string; userId?: string; status?: string };
    const ownerId = order.userId ?? order.customerId;
    const isOwner = ownerId === ctx.uid;
    const isPrivileged = ["manager", "admin", "cashier"].includes(ctx.role);
    if (!isOwner && !isPrivileged) {
      throw new HttpsError("permission-denied", "Not allowed to cancel this order.");
    }
    if (order.status === "delivered" || order.status === "cancelled") {
      throw new HttpsError("failed-precondition", "Order cannot be cancelled.");
    }
    const now = createTimestamp();
    await orderRef.update({
      status: "cancelled",
      cancelReason: payload.reason ?? "cancelled_by_user",
      updatedAt: now
    });
    await syncOrderFeedDoc(payload.orderId, {
      status: "cancelled",
      updatedAt: now
    });
    return { success: true };
  },
  cancelOrderSchema
);

export const assignDeliveryPartnerV1 = withCallableGuard(
  async (payload, ctx) => {
    assertRole(ctx.role, ["manager", "admin"]);
    const now = createTimestamp();
    const deliveryRef = db.collection(COLLECTIONS.delivery).doc();
    await deliveryRef.set({
      id: deliveryRef.id,
      orderId: payload.orderId,
      deliveryPartnerId: payload.deliveryPartnerId,
      status: "assigned",
      assignedAt: now,
      updatedAt: now
    });
    await syncDeliveryTrackingDoc(
      payload.orderId,
      {
        deliveryId: deliveryRef.id,
        deliveryPartnerId: payload.deliveryPartnerId,
        status: "assigned",
        updatedAt: now
      },
      false
    );
    return { success: true, deliveryId: deliveryRef.id };
  },
  assignDeliverySchema
);
