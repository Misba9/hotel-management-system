import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assignNearestDeliveryBoy } from "./delivery";
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
  const total = subtotal + deliveryFee;

  await orderRef.set({
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
    dayKey,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  await syncOrderFeedDoc(
    orderRef.id,
    {
      status: "pending",
      updatedAt: now.toISOString()
    },
    false
  );

  const batch = db.batch();
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

  return { orderId: orderRef.id, total };
});

export const updateKitchenStatus = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  await assertRole(request.auth.uid, ["kitchen_staff", "manager", "admin"]);

  const { orderId, status } = request.data as { orderId: string; status: "preparing" | "ready" };
  if (!orderId || !status) throw new HttpsError("invalid-argument", "orderId and status required.");

  await db.collection("orders").doc(orderId).update({
    status,
    updatedAt: new Date().toISOString()
  });
  await syncOrderFeedDoc(orderId, {
    status,
    updatedAt: new Date().toISOString()
  });

  if (status === "ready") {
    const orderSnap = await db.collection("orders").doc(orderId).get();
    const order = orderSnap.data() as { orderType: string; branchId: string } | undefined;
    if (order?.orderType === "delivery") {
      const branchSnap = await db.collection("branches").doc(order.branchId).get();
      const branch = branchSnap.data() as { location: { lat: number; lng: number } } | undefined;
      if (branch?.location) {
        const assignment = await assignNearestDeliveryBoy({
          orderId,
          branchLocation: branch.location
        });
        if (assignment) {
          await syncOrderFeedDoc(orderId, {
            deliveryStatus: "assigned",
            deliveryBoyId: assignment.riderId,
            updatedAt: new Date().toISOString()
          });
        }
      }
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
    await db.collection("orders").doc(assignment.orderId).update({ status: "out_for_delivery" });
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
    await db.collection("orders").doc(assignment.orderId).update({
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
