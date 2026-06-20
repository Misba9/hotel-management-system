import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import type {PlatformOrderDoc} from "./platform-order.js";

const messaging = getMessaging();

async function collectPosDeviceTokens(restaurantId: string): Promise<string[]> {
  const db = getFirestore();
  const snap = await db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("posDevices")
    .get();

  const tokens = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as {fcmToken?: string; fcmTokens?: unknown};
    if (typeof data.fcmToken === "string" && data.fcmToken) {
      tokens.add(data.fcmToken);
    }
    if (Array.isArray(data.fcmTokens)) {
      for (const token of data.fcmTokens) {
        if (typeof token === "string" && token) tokens.add(token);
      }
    }
  }
  return [...tokens].slice(0, 500);
}

export async function pushPlatformOrderToPosDevices(
  restaurantId: string,
  order: PlatformOrderDoc
): Promise<void> {
  const tokens = await collectPosDeviceTokens(restaurantId);
  if (tokens.length === 0) {
    console.info(`[pos-push] No POS device tokens for restaurant ${restaurantId}`);
    return;
  }

  const title = order.source === "zomato" ? "New Zomato Order" : "New Swiggy Order";
  const body = `${order.orderNumber} · ${order.customerName} · ₹${order.total}`;

  const dataPayload: Record<string, string> = {
    type: "platform_order",
    source: order.source,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    total: String(order.total),
    paymentMethod: order.paymentMethod,
    items: JSON.stringify(order.items),
    specialNotes: order.specialNotes ?? "",
  };

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {title, body},
    data: dataPayload,
  });

  if (response.failureCount > 0) {
    console.warn(
      `[pos-push] FCM failures for ${order.orderNumber}: ${response.failureCount}/${tokens.length}`
    );
  }
}
