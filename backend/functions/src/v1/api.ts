import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  COLLECTIONS,
  assertRole,
  authenticateHttp,
  createTimestamp,
  db,
  logError,
  logInfo,
  orderLifecycleStatusSchema,
  paymentMethodSchema,
  syncDeliveryTrackingDoc,
  syncOrderFeedDoc
} from "./common";
import { assignDeliveryAgentWhenOrderReady, DEFAULT_ASSIGNED_TO } from "../autoStaffAssignment";
import { assertValidTransition } from "../orderStatusLifecycle";

const createOrderHttpSchema = z.object({
  branchId: z.string().min(1),
  orderType: z.enum(["delivery", "pickup", "dine_in"]),
  paymentMethod: paymentMethodSchema,
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

const updateStatusHttpSchema = z.object({
  status: orderLifecycleStatusSchema
});

const assignDeliveryHttpSchema = z.object({
  orderId: z.string().min(1),
  deliveryPartnerId: z.string().min(1)
});

/** App Check for HTTP endpoints: enable in Firebase Console (HTTP functions do not accept `enforceAppCheck` in code like callables). */
export const platformApiV1 = onRequest(async (request, response) => {
  try {
    const identity = await authenticateHttp(request);
    const path = request.path || "/";
    const method = request.method.toUpperCase();

    if (method === "POST" && path === "/v1/orders") {
      const payload = createOrderHttpSchema.parse(request.body);
      const productSnaps = await Promise.all(
        payload.items.map((item) => db.collection(COLLECTIONS.products).doc(item.productId).get())
      );
      const pricedItems = payload.items.map((item, idx) => {
        const data = productSnaps[idx].data() as { name?: string; price?: number; available?: boolean } | undefined;
        if (!data?.available) {
          throw new HttpsError("failed-precondition", `Product unavailable: ${item.productId}`);
        }
        return {
          productId: item.productId,
          name: String(data.name ?? "Item"),
          quantity: item.quantity,
          unitPrice: Number(data.price ?? 0)
        };
      });
      const subtotal = pricedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const deliveryFee = payload.orderType === "delivery" ? 40 : 0;
      const total = subtotal + deliveryFee;
      const now = createTimestamp();
      const orderRef = db.collection(COLLECTIONS.orders).doc();
      const batch = db.batch();
      batch.set(orderRef, {
        id: orderRef.id,
        userId: identity.uid,
        branchId: payload.branchId,
        orderType: payload.orderType,
        paymentMethod: payload.paymentMethod,
        status: "pending",
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        items: pricedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity
        })),
        assignedTo: { ...DEFAULT_ASSIGNED_TO },
        deliveryAddress: payload.deliveryAddress ?? null,
        createdAt: now,
        updatedAt: now
      });
      const paymentRef = db.collection(COLLECTIONS.payments).doc();
      batch.set(paymentRef, {
        id: paymentRef.id,
        orderId: orderRef.id,
        customerId: identity.uid,
        method: payload.paymentMethod,
        status: "pending",
        amount: total,
        createdAt: now,
        updatedAt: now
      });
      await batch.commit();
      await syncOrderFeedDoc(orderRef.id, {
        status: "pending",
        updatedAt: now
      }, false);
      response.status(201).json({ success: true, orderId: orderRef.id, paymentId: paymentRef.id, total });
      return;
    }

    const statusMatch = path.match(/^\/v1\/orders\/([^/]+)\/status$/);
    if (method === "PATCH" && statusMatch) {
      assertRole(identity.role, ["kitchen_staff", "waiter", "cashier", "delivery_boy", "manager", "admin"]);
      const orderId = statusMatch[1];
      const payload = updateStatusHttpSchema.parse(request.body);
      const orderSnap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
      if (!orderSnap.exists) {
        response.status(404).json({ error: "Order not found." });
        return;
      }
      const prev = (orderSnap.data() as { status?: string } | undefined)?.status;
      try {
        assertValidTransition(prev, payload.status);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        response.status(400).json({ error: msg });
        return;
      }
      const now = createTimestamp();
      await db.collection(COLLECTIONS.orders).doc(orderId).update({
        status: payload.status,
        updatedAt: now
      });
      if (payload.status === "ready") {
        await assignDeliveryAgentWhenOrderReady(db, orderId);
      }
      await syncOrderFeedDoc(orderId, {
        status: payload.status,
        updatedAt: now
      });
      response.status(200).json({ success: true });
      return;
    }

    const cancelMatch = path.match(/^\/v1\/orders\/([^/]+)\/cancel$/);
    if (method === "POST" && cancelMatch) {
      const orderId = cancelMatch[1];
      const snap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
      if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
      const order = snap.data() as { customerId?: string; userId?: string; status?: string };
      const ownerId = order.userId ?? order.customerId;
      if (ownerId !== identity.uid && !["manager", "admin", "cashier"].includes(identity.role)) {
        throw new HttpsError("permission-denied", "Not allowed.");
      }
      if (order.status === "delivered" || order.status === "cancelled") {
        throw new HttpsError("failed-precondition", "Order cannot be cancelled.");
      }
      const now = createTimestamp();
      await db.collection(COLLECTIONS.orders).doc(orderId).update({
        status: "cancelled",
        updatedAt: now
      });
      await syncOrderFeedDoc(orderId, {
        status: "cancelled",
        updatedAt: now
      });
      response.status(200).json({ success: true });
      return;
    }

    if (method === "POST" && path === "/v1/delivery/assign") {
      assertRole(identity.role, ["manager", "admin"]);
      const payload = assignDeliveryHttpSchema.parse(request.body);
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
      await db.collection(COLLECTIONS.orders).doc(payload.orderId).set(
        { deliveryPartnerId: payload.deliveryPartnerId, updatedAt: now },
        { merge: true }
      );
      response.status(201).json({ success: true, deliveryId: deliveryRef.id });
      return;
    }

    if (method === "GET" && path === "/v1/admin/reports/sales") {
      assertRole(identity.role, ["manager", "admin"]);
      const from = String(request.query.from ?? "");
      const to = String(request.query.to ?? "");
      if (!from || !to) {
        throw new HttpsError("invalid-argument", "from and to query params are required.");
      }
      const ordersSnap = await db.collection(COLLECTIONS.orders).where("createdAt", ">=", from).where("createdAt", "<=", to).get();
      const orders = ordersSnap.docs.map((doc) => doc.data() as { total?: number; status?: string });
      const grossSales = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
      const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
      response.status(200).json({
        success: true,
        report: {
          from,
          to,
          totalOrders: orders.length,
          deliveredOrders,
          grossSales
        }
      });
      return;
    }

    response.status(404).json({
      success: false,
      error: "Route not found."
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      response.status(mapErrorCode(error.code)).json({
        success: false,
        error: error.message,
        details: error.details ?? null
      });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({
        success: false,
        error: "Validation failed.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }
    logError("Unhandled platformApiV1 error", {
      error: error instanceof Error ? error.message : String(error)
    });
    response.status(500).json({
      success: false,
      error: "Internal server error."
    });
  } finally {
    logInfo("platformApiV1 handled request", {
      method: request.method,
      path: request.path
    });
  }
});

function mapErrorCode(code: HttpsError["code"]) {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "unauthenticated":
      return 401;
    case "permission-denied":
      return 403;
    case "not-found":
      return 404;
    case "failed-precondition":
      return 412;
    default:
      return 500;
  }
}
