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
import {
  extractCustomerFields,
  extractTableFields,
  normalizeOrderStatus,
  KITCHEN_ACTIVE_STATUSES
} from "@shared/utils/canonical-order-fields";
import { DINE_IN_ORDER_TYPES } from "@shared/types/table";
import { hasManagerOperationalAccess } from "@shared/utils/manager-permissions";
import type { StaffRoleId } from "../src/constants/staff-roles";
import { assertValidTransition, type OrderLifecycleStatus } from "../src/lib/order-status-lifecycle";
import { staffDb } from "../src/lib/firebase";
import { subscribeFirestoreQuery } from "../src/lib/firestore-listener";
import { assertValidOrderId } from "../src/lib/firestore-path";
import {
  mapOrderDoc,
  MANAGER_ORDERS_LIMIT,
  ORDERS_COLLECTION,
  updateOrderStatus
} from "../src/services/orders.js";

export type StaffOrderRow = ReturnType<typeof mapOrderDoc> & {
  orderType?: string;
  tableNumber?: number;
  tableId?: string;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  paymentStatus?: string;
  tokenNumber?: number;
  printed?: boolean;
  source?: string;
  notes?: string;
  canonicalStatus: string;
};

export { updateOrderStatus, ORDERS_COLLECTION, MANAGER_ORDERS_LIMIT };

export function canonicalOrderStatus(status: string, _orderType?: string): string {
  return normalizeOrderStatus(status);
}

function enrichOrder(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDoc(id, data);
  const { tableId, tableNumber, tableName } = extractTableFields(data);
  const { customerName, customerPhone } = extractCustomerFields(data);
  const ot = data.orderType;
  const ps = data.paymentStatus;
  const tok = data.tokenNumber;
  const printedRaw = data.printed;
  const orderType = typeof ot === "string" ? ot : undefined;
  const source = typeof data.source === "string" ? data.source : undefined;
  const notes =
    typeof data.notes === "string"
      ? data.notes
      : typeof data.specialInstructions === "string"
        ? data.specialInstructions
        : undefined;
  return {
    ...base,
    orderType,
    source,
    notes,
    tableNumber,
    tableId,
    tableName,
    customerName,
    customerPhone,
    paymentStatus: typeof ps === "string" ? ps : undefined,
    tokenNumber: typeof tok === "number" && Number.isFinite(tok) ? tok : undefined,
    printed: typeof printedRaw === "boolean" ? printedRaw : undefined,
    canonicalStatus: canonicalOrderStatus(String(base.status ?? ""), orderType)
  };
}

/** After a successful auto KOT print — idempotent server-side flag (see Firestore rules). */
export async function markKitchenTicketPrinted(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  await updateDoc(ref, {
    printed: true,
    updatedAt: serverTimestamp()
  });
}

/**
 * Live listener on the full `orders` collection (per product spec). For large datasets,
 * replace with a narrower query + indexes.
 */
export function subscribeAllOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeFirestoreQuery(
    "subscribeAllOrders",
    collection(staffDb, ORDERS_COLLECTION),
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    onError
  );
}

/** Waiter-only live orders (`orderType == "dine_in"`). */
export function subscribeWaiterOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    where("orderType", "in", [...DINE_IN_ORDER_TYPES])
  );
  return subscribeFirestoreQuery(
    "subscribeWaiterOrders",
    q,
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    onError
  );
}

/** Recent `orders` (bounded) — used by legacy hooks / heavy dashboards. */
export function subscribeRecentOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
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

export const KITCHEN_QUEUE_STATUS_IN = [...KITCHEN_ACTIVE_STATUSES] as const;

/**
 * Live kitchen queue — `onSnapshot` only, production-safe (no `orderBy` + `in` combo).
 */
export function subscribeKitchenKdsOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    where("status", "in", [...KITCHEN_QUEUE_STATUS_IN])
  );

  try {
    return subscribeFirestoreQuery(
      "subscribeKitchenKdsOrders",
      q,
      (snap) => {
        onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
      },
      onError
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/** Kitchen tab: status == new */
export function subscribeKitchenNewOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(staffDb, ORDERS_COLLECTION), where("status", "==", "new"));
  return subscribeFirestoreQuery(
    "subscribeKitchenNewOrders",
    q,
    (snap) => onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>))),
    onError
  );
}

/** Kitchen tab: accepted + preparing */
export function subscribeKitchenPreparingOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    where("status", "in", ["accepted", "preparing"])
  );
  return subscribeFirestoreQuery(
    "subscribeKitchenPreparingOrders",
    q,
    (snap) => onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>))),
    onError
  );
}

/** Kitchen tab: status == ready */
export function subscribeKitchenReadyOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(staffDb, ORDERS_COLLECTION), where("status", "==", "ready"));
  return subscribeFirestoreQuery(
    "subscribeKitchenReadyOrders",
    q,
    (snap) => onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>))),
    onError
  );
}

const HISTORY_FETCH_LIMIT = 600;
const HISTORY_RESULT_LIMIT = 250;

function isKitchenHistoryStatus(status: string): boolean {
  const canon = normalizeOrderStatus(status);
  return canon === "completed" || canon === "cancelled";
}

/** Kitchen history — recent terminal orders (no composite index required). */
export function subscribeKitchenHistoryOrders(
  onNext: (rows: Array<{ order: StaffOrderRow; data: Record<string, unknown> }>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(HISTORY_FETCH_LIMIT)
  );
  return subscribeFirestoreQuery(
    "subscribeKitchenHistoryOrders",
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({
          order: enrichOrder(d.id, d.data() as Record<string, unknown>),
          data: d.data() as Record<string, unknown>
        }))
        .filter(({ order }) => isKitchenHistoryStatus(String(order.status ?? "")))
        .slice(0, HISTORY_RESULT_LIMIT);
      onNext(rows);
    },
    onError
  );
}

export async function kitchenAcceptOrder(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const canon = canonicalOrderStatus(String(order.status ?? ""));
  if (canon !== "new") throw new Error("Only new orders can be accepted.");
  const ts = serverTimestamp();
  await updateDoc(ref, {
    status: "accepted",
    acceptedAt: ts,
    sentToKitchenAt: ts,
    kitchenNotified: true,
    updatedAt: ts
  });
}

export async function kitchenMarkPreparing(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const canon = canonicalOrderStatus(String(order.status ?? ""));
  if (canon === "preparing") return;
  if (canon !== "accepted") throw new Error("Order must be accepted before preparing.");
  await updateDoc(ref, {
    status: "preparing",
    preparingAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** Cashier payment accept — mark paid; complete only when food is ready. */
export async function markCashierOrderPaid(orderId: string, paymentMethod = "cash"): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const canon = canonicalOrderStatus(String(data.status ?? ""));
  const ts = serverTimestamp();
  await updateDoc(ref, {
    paymentStatus: "paid",
    status: canon === "ready" ? "completed" : canon,
    paidAt: ts,
    paymentMethod,
    updatedAt: ts
  });
}

export async function kitchenMarkOrderReady(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const tok = data.tokenNumber;
  const tokenNumber = typeof tok === "number" && Number.isFinite(tok) ? tok : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "preparing") {
    throw new Error("Mark ready is only available while the order is preparing.");
  }
  if (orderType === "dine_in" || orderType === "table") {
    await updateDoc(ref, {
      status: "ready",
      readyAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }
  if (isWaiterPosDineInOrder({ orderType, tokenNumber })) {
    await updateDoc(ref, {
      status: "ready",
      readyAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }
  await updateDoc(ref, {
    status: "ready",
    readyAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** Waiter picked up — kitchen removes from ready queue. */
export async function kitchenMarkPickedUp(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const canon = canonicalOrderStatus(String(order.status ?? ""));
  if (canon !== "ready") throw new Error("Only ready orders can be marked picked up.");
  const ts = serverTimestamp();
  await updateDoc(ref, {
    status: "completed",
    deliveredAt: ts,
    servedAt: ts,
    updatedAt: ts
  });
}

export async function waiterMarkServed(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "ready") {
    throw new Error("Served is only available when the order is ready.");
  }
  await updateDoc(ref, { status: "completed", servedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function generateBillForOrder(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  await updateDoc(ref, {
    paymentStatus: "pending",
    billRequestedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** Walk-in / simple orders after service — marks paid without the table payment cloud fn. */
export async function markSimpleOrderPaid(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  await updateDoc(ref, {
    paymentStatus: "paid",
    status: "completed",
    updatedAt: serverTimestamp()
  });
}

/**
 * Table tickets (`orderType === "table"`): transitions enforced by Firestore rules
 * (kitchen: PLACED→PREPARING→READY; waiter: READY→SERVED).
 */
export async function applyTableTicketAction(
  orderId: string,
  action: "ready" | "served"
): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  if (data.orderType !== "table" && data.orderType !== "dine_in") {
    throw new Error("This action applies to table orders only.");
  }
  const status = String(data.status ?? "");
  const canon = canonicalOrderStatus(status);
  if (action === "ready") {
    if (canon !== "preparing" && canon !== "accepted") {
      throw new Error("Ready is only valid when status is accepted or preparing.");
    }
    await updateDoc(ref, { status: "ready", updatedAt: serverTimestamp() });
    return;
  }
  if (action === "served") {
    if (canon !== "ready") throw new Error("Served is only valid when status is ready.");
    await updateDoc(ref, { status: "completed", updatedAt: serverTimestamp() });
  }
}

/** Advance one step on the shared SaaS lifecycle (`pending` → `accepted` → …). */
export async function advanceOrderLifecycle(orderId: string, target: OrderLifecycleStatus): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const current = snap.data()?.status;
  assertValidTransition(String(current), target);
  await updateOrderStatus(orderId, target);
}

/**
 * Maps primary UI actions to Firestore writes (table pipeline vs lifecycle).
 */
export async function applyOrderRowAction(
  order: StaffOrderRow,
  action: "ready" | "served",
  role: StaffRoleId
): Promise<void> {
  const isPrivileged = hasManagerOperationalAccess(role);

  if (order.orderType === "table" || order.orderType === "dine_in") {
    const canon = canonicalOrderStatus(String(order.status ?? ""));
    if (action === "served" && (role === "waiter" || isPrivileged) && canon === "ready") {
      await applyTableTicketAction(order.id, "served");
      return;
    }
    if (action === "ready" && (role === "kitchen" || isPrivileged) && (canon === "preparing" || canon === "accepted")) {
      await applyTableTicketAction(order.id, "ready");
      return;
    }
    throw new Error("Invalid table transition for this role.");
  }

  const cur = canonicalOrderStatus(String(order.status ?? ""));

  if (role === "kitchen" || isPrivileged) {
    if (action === "ready" && cur === "preparing") {
      const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(order.id));
      await updateDoc(ref, { status: "done", updatedAt: serverTimestamp() });
      return;
    }
  }

  if ((role === "waiter" || isPrivileged) && action === "served") {
    if (cur === "ready") {
      await advanceOrderLifecycle(order.id, "out_for_delivery");
      return;
    }
    if (cur === "out_for_delivery") {
      await advanceOrderLifecycle(order.id, "delivered");
      return;
    }
  }

  throw new Error("This action is not available for your role or the current order status.");
}
