import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assignDeliveryAgentWhenOrderReady, DEFAULT_ASSIGNED_TO } from "./autoStaffAssignment";
import { assertValidTransition } from "./orderStatusLifecycle";
import { assertRole, placeOrderSchema, rateLimit, withIdempotency } from "./security";
import { syncDeliveryTrackingDoc } from "./v1/common";

const db = getFirestore();

async function syncOrderFeedDoc(orderId: string, data: Record<string, unknown>, merge = true) {
  await db.collection("orderFeeds").doc(orderId).set(data, { merge });
}

export const placeOrder = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  await assertRole(request.auth.uid, ["customer", "cashier", "manager", "admin"]);

  await rateLimit(`placeOrder:${request.auth.uid}`, 20, 60);
  const payload = placeOrderSchema.parse(request.data);
  await withIdempotency(`placeOrder:${request.auth.uid}:${request.data.idempotencyKey ?? "default"}`);

  const orderRef = db.collection("orders").doc();
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);

  const menuItems = await Promise.all(
    payload.items.map(async (item) => {
      const snap = await db.collection("menu_items").doc(item.menuItemId).get();
      if (!snap.exists) {
        throw new HttpsError("not-found", `Menu item ${item.menuItemId} not found`);
      }
      return { doc: snap.data() as { name: string; price: number }, qty: item.qty, id: item.menuItemId };
    })
  );

  const subtotal = menuItems.reduce((sum, item) => sum + item.doc.price * item.qty, 0);
  const deliveryFee = payload.orderType === "delivery" ? 40 : 0;
  const tax = 0;
  const total = subtotal + deliveryFee + tax;

  const invoiceItems = menuItems.map((item) => ({
    id: item.id,
    name: item.doc.name,
    price: item.doc.price,
    qty: item.qty
  }));

  const embeddedLineItems = menuItems.map((item) => ({
    id: item.id,
    name: item.doc.name,
    price: item.doc.price,
    qty: item.qty,
    quantity: item.qty
  }));

  const batch = db.batch();
  batch.set(orderRef, {
    id: orderRef.id,
    userId: request.auth.uid,
    branchId: payload.branchId,
    orderType: payload.orderType,
    paymentMethod: payload.paymentMethod,
    status: "pending",
    statusBucket: "active",
    subtotal,
    discount: 0,
    deliveryFee,
    total,
    invoiceId: orderRef.id,
    items: embeddedLineItems,
    assignedTo: { ...DEFAULT_ASSIGNED_TO },
    dayKey,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  batch.set(db.collection("invoices").doc(orderRef.id), {
    orderId: orderRef.id,
    invoiceId: orderRef.id,
    userId: request.auth.uid,
    items: invoiceItems,
    subtotal,
    tax,
    total,
    createdAt: FieldValue.serverTimestamp(),
    source: "legacy_placeOrder"
  });

  menuItems.forEach((item) => {
    const lineRef = db.collection("order_items").doc();
    batch.set(lineRef, {
      id: lineRef.id,
      orderId: orderRef.id,
      menuItemId: item.id,
      name: item.doc.name,
      qty: item.qty,
      unitPrice: item.doc.price,
      totalPrice: item.doc.price * item.qty
    });
  });

  const paymentRef = db.collection("payments").doc();
  batch.set(paymentRef, {
    id: paymentRef.id,
    orderId: orderRef.id,
    status: payload.paymentMethod === "cod" ? "pending" : "pending",
    method: payload.paymentMethod,
    amount: total
  });
  await batch.commit();

  await syncOrderFeedDoc(
    orderRef.id,
    {
      status: "pending",
      updatedAt: now.toISOString()
    },
    false
  );

  return { orderId: orderRef.id, total };
});

export const updateKitchenStatus = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  await assertRole(request.auth.uid, ["kitchen_staff", "manager", "admin"]);

  const { orderId, status } = request.data as { orderId: string; status: "accepted" | "preparing" | "ready" };
  if (!orderId || !status) throw new HttpsError("invalid-argument", "orderId and status required.");

  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const prev = snap.data()?.status as string | undefined;
  try {
    assertValidTransition(prev, status);
  } catch (e) {
    throw new HttpsError("failed-precondition", e instanceof Error ? e.message : String(e));
  }

  await orderRef.update({
    status,
    updatedAt: new Date().toISOString()
  });
  await syncOrderFeedDoc(orderId, {
    status,
    updatedAt: new Date().toISOString()
  });

  if (status === "ready") {
    await assignDeliveryAgentWhenOrderReady(db, orderId);
    const orderSnap = await db.collection("orders").doc(orderId).get();
    const assigned = orderSnap.data()?.assignedTo as { deliveryId?: string } | undefined;
    if (assigned?.deliveryId) {
      await syncOrderFeedDoc(orderId, {
        deliveryStatus: "assigned",
        deliveryBoyId: assigned.deliveryId,
        updatedAt: new Date().toISOString()
      });
    }
  }

  return { ok: true };
});

export const updateDeliveryStatus = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  await assertRole(request.auth.uid, ["delivery_boy", "manager", "admin"]);
  const { assignmentId, status } = request.data as {
    assignmentId: string;
    status: "picked_up" | "delivered";
  };
  if (!assignmentId || !status) throw new HttpsError("invalid-argument", "assignmentId and status are required.");
  const assignmentRef = db.collection("delivery_assignments").doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) throw new HttpsError("not-found", "Assignment not found.");

  const assignment = assignmentSnap.data() as { orderId: string; deliveryBoyId: string };

  await assignmentRef.update({
    status,
    updatedAt: new Date().toISOString()
  });

  if (status === "picked_up") {
    const orderRef = db.collection("orders").doc(assignment.orderId);
    const os = await orderRef.get();
    try {
      assertValidTransition(os.data()?.status as string | undefined, "out_for_delivery");
    } catch (e) {
      throw new HttpsError("failed-precondition", e instanceof Error ? e.message : String(e));
    }
    await orderRef.update({ status: "out_for_delivery" });
    await syncOrderFeedDoc(assignment.orderId, {
      status: "out_for_delivery",
      updatedAt: new Date().toISOString()
    });
    await syncDeliveryTrackingDoc(assignment.orderId, {
      status: "picked_up",
      updatedAt: new Date().toISOString()
    });
  }

  if (status === "delivered") {
    const orderRef = db.collection("orders").doc(assignment.orderId);
    const os = await orderRef.get();
    try {
      assertValidTransition(os.data()?.status as string | undefined, "delivered");
    } catch (e) {
      throw new HttpsError("failed-precondition", e instanceof Error ? e.message : String(e));
    }
    await orderRef.update({
      status: "delivered",
      statusBucket: "completed",
      updatedAt: new Date().toISOString()
    });
    await db.runTransaction(async (tx) => {
      const staffRef = db.collection("staff").doc(assignment.deliveryBoyId);
      const staffSnap = await tx.get(staffRef);
      const current = Number(staffSnap.data()?.activeOrders ?? 0);
      tx.update(staffRef, { activeOrders: Math.max(0, current - 1) });
    });
    await syncOrderFeedDoc(assignment.orderId, {
      status: "delivered",
      updatedAt: new Date().toISOString()
    });
    await syncDeliveryTrackingDoc(assignment.orderId, {
      status: "delivered",
      updatedAt: new Date().toISOString()
    });
  }

  return { ok: true };
});
