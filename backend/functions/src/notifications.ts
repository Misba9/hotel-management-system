import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();
const messaging = getMessaging();

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

/** Push copy aligned with product messaging (FCM notification title + body). */
function getPushForStatus(status: string): { title: string; body: string } {
  const key = status.toLowerCase().trim();
  const map: Record<string, { title: string; body: string }> = {
    pending: { title: "Order placed", body: "We received your order and will confirm it shortly." },
    created: { title: "Order placed", body: "We received your order and will confirm it shortly." },
    accepted: { title: "Order Accepted", body: "Your order is being prepared" },
    confirmed: { title: "Order accepted", body: "The store confirmed your order." },
    preparing: { title: "Being prepared", body: "Your order is being prepared." },
    ready: { title: "Order ready", body: "Your order is ready." },
    out_for_delivery: { title: "Out for delivery", body: "Your order is on the way." },
    delivered: { title: "Delivered", body: "Your order has been delivered. Enjoy!" },
    cancelled: { title: "Order cancelled", body: "Your order was cancelled." },
    rejected: { title: "Order update", body: "Your order could not be accepted." }
  };
  return (
    map[key] ?? {
      title: "Order update",
      body: STATUS_TO_CUSTOMER_MESSAGE[key] ?? `Your order is now ${status}`
    }
  );
}

async function collectFcmTokensForUser(userId: string): Promise<string[]> {
  const userSnap = await db.collection("users").doc(userId).get();
  const userData = userSnap.data() as { fcmToken?: string; fcmTokens?: unknown } | undefined;
  const tokens = new Set<string>();
  if (typeof userData?.fcmToken === "string" && userData.fcmToken) {
    tokens.add(userData.fcmToken);
  }
  if (Array.isArray(userData?.fcmTokens)) {
    for (const t of userData.fcmTokens) {
      if (typeof t === "string" && t) tokens.add(t);
    }
  }
  return [...tokens].slice(0, 500);
}

async function sendFcmToUser(
  userId: string,
  notification: { title: string; body: string },
  data: Record<string, string>
): Promise<void> {
  const tokenList = await collectFcmTokensForUser(userId);
  if (tokenList.length === 0) return;

  const multicast = await messaging.sendEachForMulticast({
    tokens: tokenList,
    notification,
    data
  });
  if (process.env.FUNCTIONS_EMULATOR && multicast.failureCount > 0) {
    console.warn("FCM multicast failures", multicast.failureCount, multicast.responses);
  }
}

export const onOrderCreatedRealtimeAlerts = onDocumentCreated("orders/{orderId}", async (event) => {
  const orderId = event.params.orderId;
  const order = (event.data?.data() ?? {}) as OrderDocShape;
  const createdAt = order.createdAt ?? new Date().toISOString();
  const status = order.status ?? "pending";

  await db.collection("customerOrderNotifications").add({
    orderId,
    type: "order_placed",
    status,
    title: "Order placed",
    body: STATUS_TO_CUSTOMER_MESSAGE[status] ?? "Your order has been created.",
    createdAt: FieldValue.serverTimestamp()
  });

  await db.collection("staffNewOrderEvents").add({
    type: "new_order",
    orderId,
    status,
    total: Number(order.total ?? 0),
    createdAt: FieldValue.serverTimestamp()
  });

  await updateHighOrderVolumeAlert();

  const uid = order.userId;
  if (typeof uid === "string" && uid.length > 0) {
    const push = getPushForStatus(status);
    await sendFcmToUser(
      uid,
      { title: push.title, body: push.body },
      {
        orderId,
        type: "order_placed",
        status: String(status)
      }
    );
  }
});

export const onOrderStatusChanged = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data() as { status?: string; userId?: string } | undefined;
  const after = event.data?.after.data() as OrderDocShape | undefined;
  if (!after || before?.status === after.status || !after.userId) return;
  const orderId = event.params.orderId;
  const now = new Date().toISOString();

  const statusKey = after.status ?? "pending";
  const push = getPushForStatus(statusKey);

  const notificationRef = db.collection("notifications").doc();
  await notificationRef.set({
    id: notificationRef.id,
    userId: after.userId,
    orderId,
    type: "order_status",
    title: push.title,
    body: push.body,
    seen: false,
    createdAt: now
  });

  await db.collection("customerOrderNotifications").add({
    orderId,
    type: "order_status",
    status: after.status ?? "pending",
    title: push.title,
    body: push.body,
    createdAt: FieldValue.serverTimestamp()
  });

  await sendFcmToUser(
    after.userId,
    { title: push.title, body: push.body },
    {
      orderId,
      type: "order_status",
      status: String(after.status ?? "")
    }
  );
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

  await db.collection("adminAlerts").doc("highOrderVolume").set({
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
