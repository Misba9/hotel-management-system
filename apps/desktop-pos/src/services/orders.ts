import {
  collection,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";
import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";
import { getStaffDb } from "@/lib/firebase";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { assertValidOrderId } from "@/lib/firestore-path";

export const ORDERS_COLLECTION = "orders";
export const MANAGER_ORDERS_LIMIT = 250;

export const DEFAULT_DELIVERY_LAT = 12.9716;
export const DEFAULT_DELIVERY_LNG = 77.5946;

export type OrderLineItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export type StaffOrderRow = {
  id: string;
  items: OrderLineItem[];
  totalAmount: number;
  riderId?: string;
  status: string;
  createdAt: { toDate?: () => Date } | null;
  updatedAt: { toDate?: () => Date } | null;
  assignedTo: { kitchenId: string; deliveryId: string; kitchen: string; delivery: string };
  customer: { name: string; address: string; phone: string };
  createdByUid?: string;
  orderType?: string;
  tableNumber?: number;
  tableId?: string;
  tableName?: string;
  paymentStatus?: string;
  tokenNumber?: number;
  printed?: boolean;
  canonicalStatus: string;
  paymentMethod?: string;
  customerName?: string;
  deliveryLocation: { lat: number; lng: number };
  riderLocation?: { lat: number; lng: number };
};

function normalizeAssignedToMap(assigned: Record<string, unknown>) {
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

export function mapOrderDoc(id: string, data: Record<string, unknown>): Omit<StaffOrderRow, "canonicalStatus"> {
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const items = itemsRaw.map((row) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const qty =
      typeof r.qty === "number" ? r.qty : typeof r.quantity === "number" ? r.quantity : 0;
    return {
      id: typeof r.id === "string" ? r.id : typeof r.productId === "string" ? r.productId : "",
      name: typeof r.name === "string" ? r.name : "",
      price:
        typeof r.price === "number" ? r.price : typeof r.unitPrice === "number" ? r.unitPrice : 0,
      qty: qty > 0 ? qty : 1
    };
  });
  const assignedRaw = data.assignedTo && typeof data.assignedTo === "object" ? data.assignedTo : {};
  const { kitchenId, deliveryId } = normalizeAssignedToMap(assignedRaw as Record<string, unknown>);
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
    riderId: typeof data.riderId === "string" ? data.riderId : undefined,
    status: typeof data.status === "string" ? data.status : "pending",
    createdAt:
      data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === "function"
        ? (data.createdAt as { toDate: () => Date })
        : null,
    updatedAt:
      data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === "function"
        ? (data.updatedAt as { toDate: () => Date })
        : null,
    assignedTo: { kitchenId, deliveryId, kitchen: kitchenId, delivery: deliveryId },
    customer: {
      name: typeof (cust as Record<string, unknown>).name === "string" ? (cust as { name: string }).name : "",
      address:
        typeof (cust as Record<string, unknown>).address === "string"
          ? (cust as { address: string }).address
          : "",
      phone:
        typeof (cust as Record<string, unknown>).phone === "string" ? (cust as { phone: string }).phone : ""
    },
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : undefined,
    orderType: typeof data.orderType === "string" ? data.orderType : undefined,
    customerName: typeof data.customerName === "string" ? data.customerName : undefined,
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : undefined,
    deliveryLocation: (() => {
      const dl = data.deliveryLocation;
      if (dl && typeof dl === "object" && typeof (dl as { lat: number }).lat === "number") {
        return { lat: (dl as { lat: number }).lat, lng: (dl as { lng: number }).lng };
      }
      return { lat: DEFAULT_DELIVERY_LAT, lng: DEFAULT_DELIVERY_LNG };
    })()
  };
}

export function canonicalOrderStatus(status: string, orderType?: string): string {
  const raw = String(status ?? "preparing");
  const u = raw.toUpperCase();
  const isTable = orderType === "dine_in" || orderType === "table";
  if (isTable) {
    if (u === "PLACED" || u === "PREPARING") return "preparing";
    if (u === "READY") return "ready";
    if (u === "SERVED" || u === "COMPLETED") return "served";
  }
  const l = raw.toLowerCase();
  if (l === "placed" || l === "pending" || l === "created" || l === "confirmed") return "preparing";
  if (l === "accepted" || l === "preparing") return "preparing";
  if (l === "ready") return "ready";
  if (l === "done") return "done";
  if (l === "served" || l === "completed") return "served";
  return l || "preparing";
}

function enrichOrder(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDoc(id, data);
  const tn = data.tableNumber;
  const ot = data.orderType;
  const ps = data.paymentStatus;
  const tok = data.tokenNumber;
  const printedRaw = data.printed;
  const tid = data.tableId;
  const tname = data.tableName;
  const orderType = typeof ot === "string" ? ot : undefined;
  return {
    ...base,
    orderType,
    tableNumber:
      typeof tn === "number" ? tn : typeof tn === "string" ? Number(tn) || undefined : undefined,
    tableId: typeof tid === "string" && tid.trim() ? tid.trim() : undefined,
    tableName: typeof tname === "string" && tname.trim() ? tname.trim() : undefined,
    paymentStatus: typeof ps === "string" ? ps : undefined,
    tokenNumber: typeof tok === "number" && Number.isFinite(tok) ? tok : undefined,
    printed: typeof printedRaw === "boolean" ? printedRaw : undefined,
    canonicalStatus: canonicalOrderStatus(String(base.status ?? ""), orderType)
  };
}

export function subscribeRecentOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getStaffDb();
  if (!db) {
    onNext([]);
    onError?.(new Error("Firestore is not initialized."));
    return () => {};
  }
  const q = query(
    collection(db, ORDERS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(MANAGER_ORDERS_LIMIT)
  );
  return subscribeFirestoreQuery(
    "subscribeRecentOrders",
    q,
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    onError
  );
}

export async function markCashierOrderPaid(orderId: string, paymentMethod = "cash"): Promise<void> {
  const db = getStaffDb();
  if (!db) throw new Error("Offline — cannot mark paid without cloud connection.");
  const ref = doc(db, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  await updateDoc(ref, {
    paymentStatus: "paid",
    status: "completed",
    paidAt: serverTimestamp(),
    paymentMethod,
    updatedAt: serverTimestamp()
  });
}

export async function kitchenMarkOrderReady(order: StaffOrderRow): Promise<void> {
  const db = getStaffDb();
  if (!db) throw new Error("Offline — cannot update order status.");
  const ref = doc(db, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const tok = data.tokenNumber;
  const tokenNumber = typeof tok === "number" && Number.isFinite(tok) ? tok : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "preparing") throw new Error("Mark ready is only available while the order is preparing.");
  if (orderType === "dine_in" || orderType === "table") {
    await updateDoc(ref, { status: "READY", readyAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return;
  }
  if (isWaiterPosDineInOrder({ orderType, tokenNumber })) {
    await updateDoc(ref, { status: "served", servedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return;
  }
  await updateDoc(ref, { status: "served", servedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
