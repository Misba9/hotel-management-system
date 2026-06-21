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
import type { StaffRoleId } from "@/constants/staff-roles";
import { assertValidTransition, type OrderLifecycleStatus } from "@/lib/order-status-lifecycle";
import { staffDb } from "@/lib/staff-db";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { assertValidOrderId } from "@/lib/firestore-path";
import type { MappedOrderDoc } from "@/services/firestore-orders-core.js";
import {
  mapOrderDoc as mapOrderDocFromCore,
  MANAGER_ORDERS_LIMIT,
  ORDERS_COLLECTION,
  updateOrderStatus as updateOrderStatusCore
} from "@/services/firestore-orders-core.js";

export type StaffOrderRow = MappedOrderDoc & {
  orderType?: string;
  tableNumber?: number;
  tableId?: string;
  tableName?: string;
  paymentStatus?: string;
  tokenNumber?: number;
  /** First auto KOT for this ticket (kitchen marks after successful auto-print). */
  printed?: boolean;
  /** Normalized lifecycle for filters + UI (pending | preparing | ready | served | …). */
  canonicalStatus: string;
};

export { updateOrderStatusCore as updateOrderStatus, ORDERS_COLLECTION, MANAGER_ORDERS_LIMIT };

/** Map raw Firestore `status` + optional `orderType` to a canonical lowercase bucket. */
export function canonicalOrderStatus(status: string, orderType?: string): string {
  const raw = String(status ?? "preparing");
  const u = raw.toUpperCase();
  const isTable = orderType === "dine_in" || orderType === "table";
  if (isTable) {
    if (u === "PLACED") return "preparing";
    if (u === "PREPARING") return "preparing";
    if (u === "READY") return "ready";
    if (u === "SERVED" || u === "COMPLETED") return "served";
  }
  const l = raw.toLowerCase();
  if (l === "pending" || l === "created" || l === "new") return "pending";
  if (l === "accepted" || l === "confirmed") return "accepted";
  if (l === "placed" || l === "preparing") return "preparing";
  if (l === "ready") return "ready";
  if (l === "done") return "done";
  if (l === "served" || l === "completed") return "served";
  return l || "preparing";
}

function enrichOrder(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDocFromCore(id, data) as MappedOrderDoc;
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
  const q = query(collection(staffDb, ORDERS_COLLECTION), where("orderType", "==", "dine_in"));
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

/**
 * Kitchen KDS queue statuses (Firestore `status` field literals).
 * Core: `pending` + `preparing`. Table tickets may still use `PLACED` / `PREPARING`.
 * No `orderBy` here — avoids composite-index requirements with `in` queries; sort client-side.
 */
export const KITCHEN_QUEUE_STATUS_IN = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "PLACED",
  "PREPARING",
  "ACCEPTED",
  "READY"
] as const;

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

/** Cashier payment accept action (default method: cash). */
export async function markCashierOrderPaid(orderId: string, paymentMethod = "cash"): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
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
      status: "READY",
      readyAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }
  if (isWaiterPosDineInOrder({ orderType, tokenNumber })) {
    await updateDoc(ref, {
      status: "served",
      servedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }
  await updateDoc(ref, {
    status: "served",
    servedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
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
  await updateDoc(ref, { status: "served", updatedAt: serverTimestamp() });
}

export async function generateBillForOrder(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  await updateDoc(ref, {
    paymentStatus: "REQUESTED",
    updatedAt: serverTimestamp()
  });
}

/** Walk-in / simple orders after service — marks paid without the table payment cloud fn. */
export async function markSimpleOrderPaid(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  await updateDoc(ref, {
    paymentStatus: "PAID",
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
  if (action === "ready") {
    if (status !== "PREPARING") throw new Error("Ready is only valid when status is PREPARING.");
    await updateDoc(ref, { status: "READY", updatedAt: serverTimestamp() });
    return;
  }
  if (action === "served") {
    if (status !== "READY") throw new Error("Served is only valid when status is READY.");
    await updateDoc(ref, { status: "served", updatedAt: serverTimestamp() });
  }
}

/** Advance one step on the shared SaaS lifecycle (`pending` → `accepted` → …). */
export async function advanceOrderLifecycle(orderId: string, target: OrderLifecycleStatus): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const current = snap.data()?.status;
  assertValidTransition(String(current), target);
  await updateOrderStatusCore(orderId, target);
}

/**
 * Maps primary UI actions to Firestore writes (table pipeline vs lifecycle).
 */
export async function applyOrderRowAction(
  order: StaffOrderRow,
  action: "ready" | "served",
  role: StaffRoleId
): Promise<void> {
  const isPrivileged = role === "admin" || role === "manager";

  if (order.orderType === "table" || order.orderType === "dine_in") {
    const st = String(order.status ?? "");
    if (action === "served" && (role === "waiter" || isPrivileged) && st === "READY") {
      await applyTableTicketAction(order.id, "served");
      return;
    }
    if (action === "ready" && (role === "kitchen" || isPrivileged) && st === "PREPARING") {
      await applyTableTicketAction(order.id, "ready");
      return;
    }
    throw new Error("Invalid table transition for this role.");
  }

  const cur = String(order.status ?? "preparing").toLowerCase();

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
