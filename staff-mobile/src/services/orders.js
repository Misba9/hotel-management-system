/**
 * Unified Firestore `orders/{orderId}` — same documents for POS, kitchen, delivery, admin, customer.
 * Real-time via onSnapshot; `id` field mirrors the document id.
 */
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { staffAuth as auth, staffDb as db } from "../lib/firebase";

export const ORDERS_COLLECTION = "orders";
export const INVOICES_COLLECTION = "invoices";

/**
 * Load persisted `invoices/{orderId}` (same id as order).
 * @param {string} orderId
 * @returns {Promise<{ id: string } & Record<string, unknown> | null>}
 */
export async function fetchInvoice(orderId) {
  const snap = await getDoc(doc(db, INVOICES_COLLECTION, orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** @deprecated Legacy filter — avoid in new code */
export const STAFF_POS_KIND = "staff_pos";

const DEFAULT_BRANCH_ID = "hyderabad-main";

/** @typedef {{ id: string; name: string; price: number; qty: number }} OrderLineItem */
/** @typedef {{ kitchenId?: string; deliveryId?: string; kitchen?: string; delivery?: string }} AssignedTo */
/** @typedef {{ name: string; address: string; phone: string }} CustomerInfo */
/**
 * @typedef {{
 *   id: string;
 *   items: OrderLineItem[];
 *   totalAmount: number;
 *   status: string;
 *   createdAt: import('@firebase/firestore').Timestamp | null;
 *   updatedAt: import('@firebase/firestore').Timestamp | null;
 *   assignedTo: AssignedTo;
 *   customer: CustomerInfo;
 *   createdByUid?: string;
 *   deliveryLocation: { lat: number; lng: number };
 *   riderLocation?: { lat: number; lng: number };
 * }} StaffOrder
 */

/** Default map pin when customer coords not set (Bangalore — replace via env later). */
export const DEFAULT_DELIVERY_LAT = 12.9716;
export const DEFAULT_DELIVERY_LNG = 77.5946;

/**
 * @param {unknown} ts
 * @returns {string}
 */
export function formatOrderRelativeTime(ts) {
  if (!ts || typeof ts.toDate !== "function") return "";
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

/**
 * @param {Record<string, unknown>} assigned
 * @returns {{ kitchenId: string; deliveryId: string }}
 */
/**
 * @param {Array<{ id?: string; name?: string; price?: number; qty?: number }>} items
 */
function normalizePosLineItems(items) {
  return items.map((it, idx) => ({
    id: typeof it.id === "string" ? it.id : `line_${idx}`,
    name: typeof it.name === "string" ? it.name : "Item",
    price: Number(it.price) || 0,
    qty: Number(it.qty) > 0 ? Number(it.qty) : 1
  }));
}

/**
 * @param {ReturnType<typeof normalizePosLineItems>} lines
 * @param {number} clientTotal
 */
function posInvoiceAmounts(lines, clientTotal) {
  const subtotal = Math.round(lines.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100;
  const tax = 0;
  const total = Math.round(Number(clientTotal) * 100) / 100;
  return { subtotal, tax, total };
}

function normalizeAssignedToMap(assigned) {
  const kitchenId =
    typeof assigned.kitchenId === "string"
      ? assigned.kitchenId
      : typeof assigned.kitchen === "string"
        ? assigned.kitchen
        : "";
  const deliveryId =
    typeof assigned.deliveryId === "string"
      ? assigned.deliveryId
      : typeof assigned.delivery === "string"
        ? assigned.delivery
        : "";
  return { kitchenId, deliveryId };
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {StaffOrder}
 */
function mapOrderDoc(id, data) {
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const items = itemsRaw.map((row) => {
    const r = row && typeof row === "object" ? row : {};
    const qty = typeof r.qty === "number" ? r.qty : typeof r.quantity === "number" ? r.quantity : 0;
    return {
      id: typeof r.id === "string" ? r.id : typeof r.productId === "string" ? r.productId : "",
      name: typeof r.name === "string" ? r.name : "",
      price: typeof r.price === "number" ? r.price : typeof r.unitPrice === "number" ? r.unitPrice : 0,
      qty: qty > 0 ? qty : 1
    };
  });
  const assignedRaw = data.assignedTo && typeof data.assignedTo === "object" ? data.assignedTo : {};
  const { kitchenId, deliveryId } = normalizeAssignedToMap(assignedRaw);
  const cust = data.customer && typeof data.customer === "object" ? data.customer : {};
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.totalAmount === "number"
        ? data.totalAmount
        : 0;
  return {
    id,
    items,
    totalAmount: total,
    status: typeof data.status === "string" ? data.status : "pending",
    createdAt: data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt : null,
    updatedAt: data.updatedAt && typeof data.updatedAt.toDate === "function" ? data.updatedAt : null,
    assignedTo: {
      kitchenId,
      deliveryId,
      kitchen: kitchenId,
      delivery: deliveryId
    },
    customer: {
      name: typeof cust.name === "string" ? cust.name : "",
      address: typeof cust.address === "string" ? cust.address : "",
      phone: typeof cust.phone === "string" ? cust.phone : ""
    },
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : undefined,
    deliveryLocation: (() => {
      const dl = data.deliveryLocation;
      if (dl && typeof dl === "object" && typeof dl.lat === "number" && typeof dl.lng === "number") {
        return { lat: dl.lat, lng: dl.lng };
      }
      const cl = data.customerLocation;
      if (cl && typeof cl === "object" && typeof cl.lat === "number" && typeof cl.lng === "number") {
        return { lat: cl.lat, lng: cl.lng };
      }
      return { lat: DEFAULT_DELIVERY_LAT, lng: DEFAULT_DELIVERY_LNG };
    })(),
    riderLocation: (() => {
      const rl = data.riderLocation;
      if (rl && typeof rl === "object" && typeof rl.lat === "number" && typeof rl.lng === "number") {
        return { lat: rl.lat, lng: rl.lng };
      }
      return undefined;
    })()
  };
}

/**
 * Cashier POS — creates unified order (`userId` = cashier).
 * @param {{ items: OrderLineItem[]; totalAmount: number; customer?: Partial<CustomerInfo>; assignedTo?: AssignedTo; deliveryLocation?: { lat: number; lng: number } }} orderData
 * @returns {Promise<{ orderId: string; invoice: { orderId: string; items: unknown[]; subtotal: number; tax: number; total: number } }>}
 */
export async function createOrder(orderData) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to create an order.");

  const ref = doc(collection(db, ORDERS_COLLECTION));
  const id = ref.id;
  const invRef = doc(db, INVOICES_COLLECTION, id);
  const lineItems = normalizePosLineItems(orderData.items);
  const { subtotal, tax, total } = posInvoiceAmounts(lineItems, orderData.totalAmount);

  const customer = {
    name: orderData.customer?.name ?? "Walk-in",
    address: orderData.customer?.address ?? "",
    phone: orderData.customer?.phone ?? ""
  };
  const deliveryLocation = orderData.deliveryLocation ?? {
    lat: DEFAULT_DELIVERY_LAT,
    lng: DEFAULT_DELIVERY_LNG
  };
  const at = orderData.assignedTo ? normalizeAssignedToMap(orderData.assignedTo) : { kitchenId: "", deliveryId: "" };

  const batch = writeBatch(db);
  batch.set(ref, {
    id,
    userId: uid,
    branchId: DEFAULT_BRANCH_ID,
    items: orderData.items,
    total,
    subtotal,
    tax,
    invoiceId: id,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    assignedTo: { kitchenId: at.kitchenId, deliveryId: at.deliveryId },
    customer,
    deliveryLocation,
    createdByUid: uid
  });
  batch.set(invRef, {
    orderId: id,
    invoiceId: id,
    userId: uid,
    items: lineItems,
    subtotal,
    tax,
    total,
    createdAt: serverTimestamp(),
    source: "pos"
  });
  await batch.commit();

  return {
    orderId: id,
    invoice: { orderId: id, items: lineItems, subtotal, tax, total }
  };
}

/**
 * Waiter dine-in — unified `orders` row (userId = waiter).
 * @param {{ userId: string; tableNumber: number; items: Array<{ name: string; price: number; qty: number }>; total: number }} payload
 */
export async function createDineInOrder(payload) {
  const ref = doc(collection(db, ORDERS_COLLECTION));
  const id = ref.id;
  const invRef = doc(db, INVOICES_COLLECTION, id);
  const lineItems = normalizePosLineItems(payload.items);
  const { subtotal, tax, total } = posInvoiceAmounts(lineItems, payload.total);

  const batch = writeBatch(db);
  batch.set(ref, {
    id,
    userId: payload.userId,
    branchId: DEFAULT_BRANCH_ID,
    orderType: "dine_in",
    type: "dine-in",
    tableNumber: payload.tableNumber,
    items: payload.items,
    total,
    subtotal,
    tax,
    invoiceId: id,
    createdByUid: payload.userId,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    assignedTo: { kitchenId: "", deliveryId: "" }
  });
  batch.set(invRef, {
    orderId: id,
    invoiceId: id,
    userId: payload.userId,
    items: lineItems,
    subtotal,
    tax,
    total,
    createdAt: serverTimestamp(),
    source: "dine_in"
  });
  await batch.commit();
  return { orderId: id, invoice: { orderId: id, items: lineItems, subtotal, tax, total } };
}

/** Throttle Firestore writes: min interval + skip tiny moves (GPS noise). */
const riderLocationThrottle = new Map();

function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Live agent GPS:
 * - `riderLocation` on `orders/{orderId}` (customer drop stays in `deliveryLocation`).
 * - `deliveryLocations/{orderId}` mirror for customer app live map.
 * Throttled to ~1 write / 3.5s unless rider moved ≥ ~35m.
 *
 * @param {string} orderId
 * @param {{ lat: number; lng: number }} location
 */
export async function updateDeliveryLocation(orderId, location) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const now = Date.now();
  const prev = riderLocationThrottle.get(orderId);
  if (prev) {
    const dt = now - prev.at;
    const moved = distanceMeters({ lat: prev.lat, lng: prev.lng }, { lat, lng });
    if (dt < 3500 && moved < 35) return;
  }
  riderLocationThrottle.set(orderId, { at: now, lat, lng });

  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    riderLocation: { lat, lng },
    updatedAt: serverTimestamp()
  });

  try {
    await setDoc(
      doc(db, "deliveryLocations", orderId),
      {
        orderId,
        userId: uid,
        lat,
        lng,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[updateDeliveryLocation] deliveryLocations mirror:", e);
    }
  }
}

/**
 * Subscribe to all recent orders (newest first). For manager / analytics.
 * @param {(orders: StaffOrder[]) => void} callback
 * @param {(err: import('firebase/firestore').FirestoreError) => void} [onError]
 * @returns {() => void}
 */
export function subscribeToOrders(callback, onError) {
  const q = query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc"), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapOrderDoc(d.id, d.data()));
      callback(list);
    },
    onError
  );
}

/** Pending / accepted (inbox) + preparing (cooking) — excludes ready+ (handed to delivery). */
const KITCHEN_ACTIVE = new Set(["pending", "accepted", "preparing", "created", "confirmed"]);

/**
 * Kitchen queue (onSnapshot) — same `orders` docs as POS; filter keeps active kitchen work only.
 * @param {(orders: StaffOrder[]) => void} callback
 * @param {(err: import('firebase/firestore').FirestoreError) => void} [onError]
 */
export function subscribeKitchenOrders(callback, onError) {
  const q = query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc"), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap
        .docs.map((d) => mapOrderDoc(d.id, d.data()))
        .filter((o) => {
          const s = (o.status || "").toLowerCase();
          return KITCHEN_ACTIVE.has(s);
        });
      callback(list);
    },
    onError
  );
}

/**
 * Delivery — ready pool + out_for_delivery assigned to this rider.
 * @param {string} deliveryUid
 * @param {(orders: StaffOrder[]) => void} callback
 * @param {(err: import('firebase/firestore').FirestoreError) => void} [onError]
 */
export function subscribeDeliveryOrders(deliveryUid, callback, onError) {
  const q = query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc"), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => mapOrderDoc(d.id, d.data()));
      const filtered = all.filter((o) => {
        if (o.status === "ready") return true;
        if (o.status === "out_for_delivery") {
          const dAssign = o.assignedTo?.deliveryId ?? o.assignedTo?.delivery ?? "";
          return dAssign === deliveryUid;
        }
        return false;
      });
      callback(filtered);
    },
    onError
  );
}

/**
 * @param {string} orderId
 * @param {string} status
 * @param {Record<string, unknown>} [extra] merged into update (e.g. dot paths for assignedTo)
 */
export async function updateOrderStatus(orderId, status, extra = {}) {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status,
    updatedAt: serverTimestamp(),
    ...extra
  });
}

/**
 * @param {string} orderId
 * @param {string} deliveryUid
 */
export async function assignDelivery(orderId, deliveryUid) {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    "assignedTo.deliveryId": deliveryUid,
    updatedAt: serverTimestamp()
  });
}

/**
 * Accept → preparing with kitchen uid on ticket.
 * @param {string} orderId
 * @param {string} kitchenUid
 */
export async function acceptKitchenOrder(orderId, kitchenUid) {
  await updateOrderStatus(orderId, "preparing", {
    "assignedTo.kitchenId": kitchenUid
  });
}

/**
 * @param {string} orderId
 * @param {string} deliveryUid
 */
export async function startDelivery(orderId, deliveryUid) {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status: "out_for_delivery",
    "assignedTo.deliveryId": deliveryUid,
    updatedAt: serverTimestamp()
  });
}
