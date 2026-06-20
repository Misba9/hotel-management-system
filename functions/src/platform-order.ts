import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {pushPlatformOrderToPosDevices} from "./pos-push.js";

export type OrderSource = "zomato" | "swiggy";

export type PlatformLineItem = {
  productId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note?: string;
};

export type PlatformOrderDoc = {
  id: string;
  orderNumber: string;
  source: OrderSource;
  orderType: "online";
  customerName: string;
  phone: string;
  email?: string;
  items: PlatformLineItem[];
  subtotal: number;
  total: number;
  status: "preparing";
  paymentStatus: "paid" | "pending";
  paymentMethod: string;
  deliveryAddress?: {
    addressLine?: string;
    city?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  externalOrderId: string;
  specialNotes?: string;
  createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
  updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
};

export type PosInboxDoc = {
  orderId: string;
  orderNumber: string;
  source: OrderSource;
  customerName: string;
  phone: string;
  items: PlatformLineItem[];
  total: number;
  paymentMethod: string;
  specialNotes?: string;
  processed: boolean;
  createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
};

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

export function restaurantIdFromEnv(): string {
  return env("DESKTOP_POS_RESTAURANT_ID") ?? env("RESTAURANT_ID") ?? "default";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function mapItemsFromPayload(
  rawItems: unknown,
  fallbackPrefix: string
): PlatformLineItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const qty = asNumber(row.quantity ?? row.qty ?? row.count, 1);
    const unitPrice = asNumber(row.unitPrice ?? row.price ?? row.item_price, 0);
    const lineTotal = asNumber(row.lineTotal ?? row.total ?? row.item_total, unitPrice * qty);
    const name =
      asString(row.name ?? row.item_name ?? row.title) ||
      `${fallbackPrefix} Item ${index + 1}`;

    return {
      productId: asString(row.productId ?? row.item_id ?? row.id) || undefined,
      name,
      qty: qty > 0 ? qty : 1,
      unitPrice: roundMoney(unitPrice),
      lineTotal: roundMoney(lineTotal),
      note: asString(row.note ?? row.notes ?? row.instructions) || undefined,
    };
  });
}

export function mapZomatoPayload(body: Record<string, unknown>): PlatformOrderDoc {
  const externalOrderId = asString(
    body.order_id ?? body.orderId ?? body.tab_id ?? body.id
  );
  const customer = (body.customer ?? body.customer_details ?? {}) as Record<string, unknown>;
  const items = mapItemsFromPayload(
    body.items ?? body.order_items ?? body.dishes,
    "Zomato"
  );
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = roundMoney(asNumber(body.order_total ?? body.total ?? body.bill_amount, subtotal));
  const orderNumber =
    asString(body.order_number ?? body.orderNumber) ||
    `ZOM-${externalOrderId || Date.now()}`;

  return {
    id: `zomato-${externalOrderId || orderNumber}`,
    orderNumber,
    source: "zomato",
    orderType: "online",
    customerName: asString(customer.name ?? body.customer_name, "Zomato Customer"),
    phone: asString(customer.phone ?? body.customer_phone ?? body.phone),
    email: asString(customer.email ?? body.customer_email) || undefined,
    items,
    subtotal: roundMoney(subtotal),
    total,
    status: "preparing",
    paymentStatus: asString(body.payment_status).toLowerCase() === "paid" ? "paid" : "pending",
    paymentMethod: asString(body.payment_method, "online"),
    deliveryAddress: {
      addressLine: asString(body.delivery_address ?? body.address),
      city: asString(body.city),
      pincode: asString(body.pincode ?? body.pin_code),
      lat: asNumber(body.latitude ?? body.lat, NaN) || undefined,
      lng: asNumber(body.longitude ?? body.lng, NaN) || undefined,
    },
    externalOrderId: externalOrderId || orderNumber,
    specialNotes: asString(body.special_instructions ?? body.instructions) || undefined,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function mapSwiggyPayload(body: Record<string, unknown>): PlatformOrderDoc {
  const externalOrderId = asString(body.orderId ?? body.order_id ?? body.id);
  const customer = (body.customer ?? body.customerDetails ?? {}) as Record<string, unknown>;
  const items = mapItemsFromPayload(
    body.orderItems ?? body.items ?? body.order_items,
    "Swiggy"
  );
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = roundMoney(asNumber(body.orderTotal ?? body.total ?? body.billAmount, subtotal));
  const orderNumber =
    asString(body.orderNumber ?? body.order_number) ||
    `SWG-${externalOrderId || Date.now()}`;

  const address = (body.deliveryAddress ?? body.address ?? {}) as Record<string, unknown>;

  return {
    id: `swiggy-${externalOrderId || orderNumber}`,
    orderNumber,
    source: "swiggy",
    orderType: "online",
    customerName: asString(customer.name ?? body.customerName, "Swiggy Customer"),
    phone: asString(customer.phone ?? body.customerPhone ?? body.phone),
    email: asString(customer.email ?? body.customerEmail) || undefined,
    items,
    subtotal: roundMoney(subtotal),
    total,
    status: "preparing",
    paymentStatus: asString(body.paymentStatus ?? body.payment_status).toLowerCase() === "paid" ?
      "paid" :
      "pending",
    paymentMethod: asString(body.paymentMethod ?? body.payment_method, "online"),
    deliveryAddress: {
      addressLine: asString(address.addressLine ?? address.fullAddress ?? address.line1),
      city: asString(address.city),
      pincode: asString(address.pincode ?? address.pinCode),
      lat: asNumber(address.lat ?? address.latitude, NaN) || undefined,
      lng: asNumber(address.lng ?? address.longitude, NaN) || undefined,
    },
    externalOrderId: externalOrderId || orderNumber,
    specialNotes: asString(body.specialInstructions ?? body.instructions) || undefined,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function persistPlatformOrder(order: PlatformOrderDoc): Promise<void> {
  const db = getFirestore();
  const restaurantId = restaurantIdFromEnv();

  const batch = db.batch();
  const orderRef = db.collection("orders").doc(order.id);
  batch.set(orderRef, order, {merge: true});

  const restaurantOrderRef = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("orders")
    .doc(order.id);
  batch.set(restaurantOrderRef, order, {merge: true});

  const inboxRef = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("posInbox")
    .doc(order.id);
  const inboxDoc: PosInboxDoc = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    customerName: order.customerName,
    phone: order.phone,
    items: order.items,
    total: order.total,
    paymentMethod: order.paymentMethod,
    specialNotes: order.specialNotes,
    processed: false,
    createdAt: FieldValue.serverTimestamp(),
  };
  batch.set(inboxRef, inboxDoc, {merge: true});

  await batch.commit();
  await pushPlatformOrderToPosDevices(restaurantId, order);
}
