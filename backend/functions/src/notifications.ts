/**
 * FCM (Firebase Cloud Messaging) — staff + customer order alerts (Admin SDK).
 *
 * Setup
 * - Firebase Console → Cloud Messaging: enable Web Push (VAPID) for customer-web; mobile apps as needed.
 * - Customer web: `users/{uid}.fcmToken` (+ `fcmTokens[]`) via `registerPushTokenForUser` (see customer-web `fcm.ts`).
 * - Staff: same user doc fields from staff mobile.
 *
 * Customer push (order lifecycle)
 * - **Updates only** for statuses: `preparing`, `out_for_delivery`, `delivered` (reduces noise vs every transition).
 * - Callable {@link sendPushNotificationToUser} for admin/manager test sends.
 *
 * Triggers (this module)
 * - New `orders/*` → kitchen + admins (no customer “order placed” push — only status updates below).
 * - Order `status` → READY (table) → waiters; customer FCM for delivery pipeline statuses above.
 * - `paymentStatus` → REQUESTED (table) → cashiers.
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();
const messaging = getMessaging();
const adminAuth = getAuth();

type OrderDocShape = {
  status?: string;
  userId?: string;
  total?: number;
  totalAmount?: number;
  createdAt?: string;
  orderType?: string;
  tableNumber?: number;
  createdByUid?: string;
  paymentStatus?: string;
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

/** Statuses that trigger a customer push (order **update** — not “placed”). */
const CUSTOMER_ORDER_PUSH_STATUSES = new Set(["preparing", "out_for_delivery", "delivered"]);

function shouldSendCustomerOrderPush(status: string): boolean {
  const key = String(status).toLowerCase().trim().replace(/\s+/g, "_");
  return CUSTOMER_ORDER_PUSH_STATUSES.has(key);
}

function isFcmEligibleCustomerUid(uid: string | undefined): boolean {
  if (!uid || typeof uid !== "string") return false;
  if (uid === "guest_user") return false;
  return true;
}

/**
 * Sends FCM to all tokens on `users/{userId}` (`fcmToken` + `fcmTokens`).
 * Use for customer order updates and admin test sends.
 */
export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  await sendFcmToUser(userId, { title, body }, data);
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

async function collectStaffUidsByRoles(roles: string[]): Promise<string[]> {
  const want = new Set(roles);
  const out = new Set<string>();
  let nextPageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      const role = String(user.customClaims?.role ?? "");
      if (want.has(role)) out.add(user.uid);
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return [...out];
}

async function collectAdminAndManagerUids(): Promise<string[]> {
  return collectStaffUidsByRoles(["admin", "manager"]);
}

async function collectFcmTokensForUids(uids: string[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
  const tokens = new Set<string>();
  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((uid) => db.collection("users").doc(uid).get()));
    for (const snap of snaps) {
      const row = snap.data() as { fcmToken?: string; fcmTokens?: unknown } | undefined;
      if (typeof row?.fcmToken === "string" && row.fcmToken) tokens.add(row.fcmToken);
      if (Array.isArray(row?.fcmTokens)) {
        for (const t of row.fcmTokens) {
          if (typeof t === "string" && t) tokens.add(t);
        }
      }
    }
  }
  return [...tokens].slice(0, 500);
}

async function sendStaffMulticast(
  tokens: string[],
  notification: { title: string; body: string },
  data: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) return;
  const multicast = await messaging.sendEachForMulticast({
    tokens,
    notification,
    data
  });
  if (process.env.FUNCTIONS_EMULATOR && multicast.failureCount > 0) {
    console.warn("FCM multicast failures", multicast.failureCount, multicast.responses);
  }
}

async function sendFcmToAdminsOnNewOrder(orderId: string, total: number): Promise<void> {
  const uids = await collectAdminAndManagerUids();
  const tokens = await collectFcmTokensForUids(uids);
  if (tokens.length === 0) return;
  await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "New order received",
      body: `Order #${orderId.slice(0, 8)} · Rs. ${Math.round(total)}`
    },
    data: {
      type: "new_order",
      orderId
    }
  });
}

function isWaiterFloorOrder(order: OrderDocShape): boolean {
  const ot = String(order.orderType ?? "").toLowerCase();
  return ot === "table" || ot === "dine_in";
}

/** FCM to kitchen devices when a waiter opens a table / dine-in ticket. */
async function sendFcmToKitchenOnWaiterPlacedOrder(orderId: string, order: OrderDocShape): Promise<void> {
  const uids = await collectStaffUidsByRoles(["kitchen", "kitchen_staff"]);
  const tokens = await collectFcmTokensForUids(uids);
  const tableHint =
    order.tableNumber != null && Number.isFinite(Number(order.tableNumber))
      ? `Table ${order.tableNumber}`
      : "Dine-in";
  const amount = Number(order.totalAmount ?? order.total ?? 0);
  await sendStaffMulticast(
    tokens,
    {
      title: "New kitchen order",
      body: `${tableHint} · #${orderId.slice(0, 8)} · Rs. ${Math.round(amount)}`
    },
    {
      type: "new_kitchen_order",
      orderId,
      orderType: String(order.orderType ?? "")
    }
  );
}

/** Web / API-created orders (delivery, pickup, dine_in, …) — notify kitchen staff. */
async function sendFcmToKitchenOnGenericNewOrder(orderId: string, order: OrderDocShape): Promise<void> {
  const uids = await collectStaffUidsByRoles(["kitchen", "kitchen_staff"]);
  const tokens = await collectFcmTokensForUids(uids);
  const ot = String(order.orderType ?? "order").trim().toLowerCase() || "order";
  const amount = Math.round(Number(order.totalAmount ?? order.total ?? 0));
  await sendStaffMulticast(
    tokens,
    {
      title: "New order — kitchen",
      body: `${ot} · #${orderId.slice(0, 8)} · Rs. ${amount}`
    },
    {
      type: "new_kitchen_order",
      orderId,
      orderType: String(order.orderType ?? "")
    }
  );
}

async function sendFcmToWaitersTableOrderReady(orderId: string, order: OrderDocShape): Promise<void> {
  const uids = await collectStaffUidsByRoles(["waiter"]);
  const tokens = await collectFcmTokensForUids(uids);
  const tn = order.tableNumber != null ? String(order.tableNumber) : "—";
  await sendStaffMulticast(
    tokens,
    {
      title: "Order ready",
      body: `Table ${tn} — order #${orderId.slice(0, 8)} is ready to serve.`
    },
    {
      type: "order_ready_waiter",
      orderId,
      orderType: String(order.orderType ?? "")
    }
  );
}

async function sendFcmToCashiersBillRequested(orderId: string, order: OrderDocShape): Promise<void> {
  const uids = await collectStaffUidsByRoles(["cashier"]);
  const tokens = await collectFcmTokensForUids(uids);
  const tn = order.tableNumber != null ? String(order.tableNumber) : "—";
  const amount = Math.round(Number(order.totalAmount ?? order.total ?? 0));
  await sendStaffMulticast(
    tokens,
    {
      title: "Bill requested",
      body: `Table ${tn} · #${orderId.slice(0, 8)} · Rs. ${amount} — open cashier to collect payment.`
    },
    {
      type: "table_bill_requested",
      orderId,
      orderType: String(order.orderType ?? "")
    }
  );
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
  await sendFcmToAdminsOnNewOrder(orderId, Number(order.totalAmount ?? order.total ?? 0));

  const waiterPlaced = isWaiterFloorOrder(order);
  if (waiterPlaced) {
    await sendFcmToKitchenOnWaiterPlacedOrder(orderId, order);
  } else {
    await sendFcmToKitchenOnGenericNewOrder(orderId, order);
  }

});

export const onOrderStatusChanged = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data() as OrderDocShape | undefined;
  const after = event.data?.after.data() as OrderDocShape | undefined;
  if (!after) return;
  const orderId = event.params.orderId;
  const now = new Date().toISOString();

  const beforePay = String(before?.paymentStatus ?? "").toUpperCase();
  const afterPay = String(after.paymentStatus ?? "").toUpperCase();
  if (isWaiterFloorOrder(after) && afterPay === "REQUESTED" && beforePay !== "REQUESTED") {
    await sendFcmToCashiersBillRequested(orderId, after);
  }

  const statusBefore = String(before?.status ?? "");
  const statusAfter = String(after.status ?? "");
  const statusChanged = statusBefore !== statusAfter;
  if (statusChanged && isWaiterFloorOrder(after) && statusAfter.toLowerCase() === "ready") {
    await sendFcmToWaitersTableOrderReady(orderId, after);
  }

  if (!statusChanged || !after.userId) return;

  const statusKey = after.status ?? "pending";
  let push = getPushForStatus(statusKey);
  if (isWaiterFloorOrder(after) && String(statusKey).toLowerCase() === "ready") {
    const tn = after.tableNumber != null ? String(after.tableNumber) : "—";
    push = {
      title: "Order ready",
      body: `Table ${tn} — ready to serve.`
    };
  }

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

  const floorReady = isWaiterFloorOrder(after) && String(statusKey).toLowerCase() === "ready";
  if (floorReady) {
    return;
  }

  if (shouldSendCustomerOrderPush(String(statusKey)) && isFcmEligibleCustomerUid(after.userId)) {
    await sendFcmToUser(
      after.userId,
      { title: push.title, body: push.body },
      {
        orderId,
        type: "order_status",
        status: String(after.status ?? "")
      }
    );
  }
});

/**
 * Callable: send a one-off FCM to `users/{userId}` (manager/admin only).
 * Wraps {@link sendNotification} for testing or manual alerts.
 */
export const sendPushNotificationToUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const role = String(request.auth.token?.role ?? "");
  if (!["manager", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Manager or admin role required.");
  }
  const raw = request.data as { userId?: unknown; title?: unknown; body?: unknown; orderId?: unknown };
  const userId = typeof raw.userId === "string" ? raw.userId.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!userId || !title || !body) {
    throw new HttpsError("invalid-argument", "userId, title, and body are required.");
  }
  const orderId = typeof raw.orderId === "string" ? raw.orderId : "";
  await sendNotification(userId, title, body, {
    type: "admin_push",
    orderId,
    status: ""
  });
  return { ok: true as const };
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
