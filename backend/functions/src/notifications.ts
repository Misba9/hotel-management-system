import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getDatabase } from "firebase-admin/database";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();
const messaging = getMessaging();
const rtdb = getDatabase();

type OrderDocShape = {
  status?: string;
  userId?: string;
  total?: number;
  createdAt?: string;
};

const STATUS_TO_CUSTOMER_MESSAGE: Record<string, string> = {
  pending: "Order placed successfully.",
  created: "Order placed successfully.",
  confirmed: "Order accepted by the store.",
  preparing: "Your order is being prepared.",
  ready: "Your order is ready.",
  out_for_delivery: "Your order is out for delivery.",
  delivered: "Your order has been delivered."
};

export const onOrderCreatedRealtimeAlerts = onDocumentCreated("orders/{orderId}", async (event) => {
  const orderId = event.params.orderId;
  const order = (event.data?.data() ?? {}) as OrderDocShape;
  const createdAt = order.createdAt ?? new Date().toISOString();
  const status = order.status ?? "pending";

  await rtdb.ref(`notifications/customers/orders/${orderId}`).push({
    type: "order_placed",
    orderId,
    status,
    title: "Order placed",
    body: STATUS_TO_CUSTOMER_MESSAGE[status] ?? "Your order has been created.",
    createdAt
  });

  await rtdb.ref(`notifications/staff/newOrders`).push({
    type: "new_order",
    orderId,
    status,
    total: Number(order.total ?? 0),
    createdAt
  });

  await updateHighOrderVolumeAlert();
});

export const onOrderStatusChanged = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data() as { status?: string; userId?: string } | undefined;
  const after = event.data?.after.data() as OrderDocShape | undefined;
  if (!after || before?.status === after.status || !after.userId) return;
  const orderId = event.params.orderId;
  const now = new Date().toISOString();

  const notificationRef = db.collection("notifications").doc();
  await notificationRef.set({
    id: notificationRef.id,
    userId: after.userId,
    title: "Order Update",
    body: `Your order is now ${after.status}`,
    seen: false,
    createdAt: now
  });

  await rtdb.ref(`notifications/customers/orders/${orderId}`).push({
    type: "order_status",
    orderId,
    status: after.status ?? "pending",
    title: "Order Update",
    body: STATUS_TO_CUSTOMER_MESSAGE[after.status ?? "pending"] ?? `Your order is now ${after.status}`,
    createdAt: now
  });

  const userSnap = await db.collection("users").doc(after.userId).get();
  const token = userSnap.data()?.fcmToken as string | undefined;
  if (token) {
    await messaging.send({
      token,
      notification: {
        title: "Order Update",
        body: `Your order is now ${after.status}`
      }
    });
  }
});

async function updateHighOrderVolumeAlert() {
  const now = Date.now();
  const windowMinutes = Number(process.env.HIGH_ORDER_ALERT_WINDOW_MINUTES ?? 15);
  const threshold = Number(process.env.HIGH_ORDER_ALERT_THRESHOLD ?? 20);
  const fromIso = new Date(now - windowMinutes * 60 * 1000).toISOString();
  const recentOrdersSnap = await db.collection("orders").where("createdAt", ">=", fromIso).get();
  const recentCount = recentOrdersSnap.size;
  const active = recentCount >= threshold;
  const nowIso = new Date(now).toISOString();

  await rtdb.ref("alerts/admin/highOrderVolume").set({
    active,
    count: recentCount,
    threshold,
    windowMinutes,
    message: active
      ? `High order volume detected: ${recentCount} orders in last ${windowMinutes} minutes.`
      : `Order volume normal: ${recentCount} orders in last ${windowMinutes} minutes.`,
    updatedAt: nowIso
  });
}
