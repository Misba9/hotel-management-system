import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";

import { staffAuth, staffDb } from "../src/lib/firebase";
import { ORDERS_COLLECTION } from "../src/services/orders.js";

export const DELIVERIES_COLLECTION = "deliveries";

export type DeliveryRow = {
  id: string;
  orderId: string;
  address: string;
  mobile?: string;
  status: string;
  customerName: string;
  deliveryBoyId?: string;
  driverUid?: string;
};

export type DeliveryMessage = {
  id: string;
  authorUid: string;
  body: string;
  createdAt: unknown;
};

function mapDeliveryDoc(id: string, data: Record<string, unknown>): DeliveryRow {
  const addr = typeof data.address === "string" && data.address.trim() ? data.address.trim() : "Address on file";
  const oid = typeof data.orderId === "string" ? data.orderId : "";
  const st = typeof data.status === "string" ? data.status : "assigned";
  const name =
    typeof data.customerName === "string" && data.customerName.trim()
      ? data.customerName.trim()
      : "Customer";
  const mobile = typeof data.mobile === "string" && data.mobile.trim() ? data.mobile.trim() : undefined;
  const deliveryBoyId =
    typeof data.deliveryBoyId === "string" && data.deliveryBoyId.trim()
      ? data.deliveryBoyId.trim()
      : typeof data.driverUid === "string" && data.driverUid.trim()
        ? data.driverUid.trim()
        : undefined;
  return { id, orderId: oid, address: addr, mobile, status: st, customerName: name, deliveryBoyId, driverUid: deliveryBoyId };
}

/**
 * Live assigned runs: `deliveryBoyId ==` signed-in rider (`onSnapshot`).
 */
export function subscribeAssignedDeliveries(
  onNext: (rows: DeliveryRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const uid = staffAuth.currentUser?.uid;
  if (!uid) {
    onNext([]);
    return () => {};
  }
  const q = query(
    collection(staffDb, DELIVERIES_COLLECTION),
    where("deliveryBoyId", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(80)
  );
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapDeliveryDoc(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

/** @deprecated Prefer {@link subscribeAssignedDeliveries}. */
export function subscribeMyDeliveries(
  onNext: (rows: DeliveryRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeAssignedDeliveries(onNext, onError);
}

export async function getDeliveryDoc(deliveryId: string): Promise<DeliveryRow | null> {
  const snap = await getDoc(doc(staffDb, DELIVERIES_COLLECTION, deliveryId));
  if (!snap.exists()) return null;
  return mapDeliveryDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function fetchDeliveryByOrderId(orderId: string): Promise<DeliveryRow | null> {
  const q = query(
    collection(staffDb, DELIVERIES_COLLECTION),
    where("orderId", "==", orderId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapDeliveryDoc(d.id, d.data() as Record<string, unknown>);
}

export type OrderByTokenResult = {
  orderId: string;
  tokenNumber: number;
  items: Array<{ name: string; price: number; qty: number }>;
  total: number;
};

/** Full order snapshot for the delivery run screen (customer + lines). */
export type OrderDeliveryDetail = {
  orderId: string;
  customerName: string;
  mobile: string;
  address: string;
  items: Array<{ name: string; price: number; qty: number }>;
  total: number;
  tokenNumber?: number;
};

export async function fetchOrderDetailForDelivery(orderId: string): Promise<OrderDeliveryDetail | null> {
  const snap = await getDoc(doc(staffDb, ORDERS_COLLECTION, orderId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const cust = data.customer && typeof data.customer === "object" ? (data.customer as Record<string, unknown>) : {};
  const customerName =
    (typeof data.customerName === "string" && data.customerName.trim()) ||
    (typeof cust.name === "string" && cust.name.trim()) ||
    "Customer";
  const mobile =
    (typeof data.phone === "string" && data.phone.trim()) ||
    (typeof cust.phone === "string" && cust.phone.trim()) ||
    (typeof data.mobile === "string" && data.mobile.trim()) ||
    "";
  const address =
    (typeof data.address === "string" && data.address.trim()) ||
    (typeof data.deliveryAddress === "string" && data.deliveryAddress.trim()) ||
    (typeof cust.address === "string" && cust.address.trim()) ||
    "";
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const items = itemsRaw.map((row: unknown) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const qty = typeof r.qty === "number" ? r.qty : typeof r.quantity === "number" ? r.quantity : 1;
    const price = typeof r.unitPrice === "number" ? r.unitPrice : typeof r.price === "number" ? r.price : 0;
    const name = typeof r.name === "string" ? r.name : "Item";
    return { name, price, qty: qty > 0 ? qty : 1 };
  });
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.totalAmount === "number"
        ? data.totalAmount
        : 0;
  const tokenNumber = typeof data.tokenNumber === "number" ? data.tokenNumber : undefined;
  return { orderId, customerName, mobile, address, items, total, tokenNumber };
}

export async function fetchOrderByTokenNumber(tokenNumber: number): Promise<OrderByTokenResult | null> {
  if (!Number.isFinite(tokenNumber) || tokenNumber < 1) return null;
  const q = query(collection(staffDb, ORDERS_COLLECTION), where("tokenNumber", "==", tokenNumber), limit(5));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as Record<string, unknown>;
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const items = itemsRaw.map((row: unknown) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const qty = typeof r.qty === "number" ? r.qty : typeof r.quantity === "number" ? r.quantity : 1;
    const price = typeof r.unitPrice === "number" ? r.unitPrice : typeof r.price === "number" ? r.price : 0;
    const name = typeof r.name === "string" ? r.name : "Item";
    return { name, price, qty: qty > 0 ? qty : 1 };
  });
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.totalAmount === "number"
        ? data.totalAmount
        : 0;
  return {
    orderId: d.id,
    tokenNumber,
    items,
    total
  };
}

export async function markDeliveryPicked(deliveryId: string): Promise<void> {
  const ref = doc(staffDb, DELIVERIES_COLLECTION, deliveryId);
  await updateDoc(ref, { status: "picked", updatedAt: serverTimestamp() });
}

export async function markDeliveryDelivered(deliveryId: string): Promise<void> {
  const ref = doc(staffDb, DELIVERIES_COLLECTION, deliveryId);
  await updateDoc(ref, { status: "delivered", updatedAt: serverTimestamp() });
}

const DELIVERY_LOCATIONS = "deliveryLocations";

/** Pushes live GPS (+ optional rider display fields) to `deliveryLocations/{orderId}`. */
export async function publishRiderLocation(params: {
  orderId: string;
  riderUid: string;
  lat: number;
  lng: number;
  riderName?: string;
  riderMobile?: string;
}): Promise<void> {
  const ref = doc(staffDb, DELIVERY_LOCATIONS, params.orderId);
  await setDoc(
    ref,
    {
      orderId: params.orderId,
      userId: params.riderUid,
      lat: params.lat,
      lng: params.lng,
      updatedAt: serverTimestamp(),
      ...(params.riderName ? { riderName: params.riderName } : {}),
      ...(params.riderMobile ? { riderMobile: params.riderMobile } : {})
    },
    { merge: true }
  );
}

export function subscribeDeliveryMessages(
  deliveryId: string,
  onNext: (messages: DeliveryMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const col = collection(staffDb, DELIVERIES_COLLECTION, deliveryId, "messages");
  const q = query(col, orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list: DeliveryMessage[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          authorUid: typeof x.authorUid === "string" ? x.authorUid : "",
          body: typeof x.body === "string" ? x.body : "",
          createdAt: x.createdAt
        };
      });
      onNext(list);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

export function subscribeDeliveryDoc(
  deliveryId: string,
  onNext: (row: DeliveryRow | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(staffDb, DELIVERIES_COLLECTION, deliveryId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      onNext(mapDeliveryDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

export async function sendDeliveryMessage(deliveryId: string, body: string): Promise<void> {
  const uid = staffAuth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  const trimmed = body.trim();
  if (!trimmed) return;
  const col = collection(staffDb, DELIVERIES_COLLECTION, deliveryId, "messages");
  await addDoc(col, {
    authorUid: uid,
    body: trimmed.slice(0, 2000),
    createdAt: serverTimestamp()
  });
}
