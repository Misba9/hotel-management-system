import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";

import type { StaffRoleId } from "../src/constants/staff-roles";
import { assertValidTransition, type OrderLifecycleStatus } from "../src/lib/order-status-lifecycle";
import { staffDb } from "../src/lib/firebase";
import { confirmTableOrderPayment } from "../src/services/confirm-table-order-payment";
import {
  mapOrderDoc,
  MANAGER_ORDERS_LIMIT,
  ORDERS_COLLECTION,
  updateOrderStatus
} from "../src/services/orders.js";

export type StaffOrderRow = ReturnType<typeof mapOrderDoc> & {
  orderType?: string;
  tableNumber?: number;
  paymentStatus?: string;
  tokenNumber?: number;
  /** Normalized lifecycle for filters + UI (pending | preparing | ready | served | …). */
  canonicalStatus: string;
};

export { updateOrderStatus, ORDERS_COLLECTION, MANAGER_ORDERS_LIMIT };

/** Map raw Firestore `status` + optional `orderType` to a canonical lowercase bucket. */
export function canonicalOrderStatus(status: string, orderType?: string): string {
  const raw = String(status ?? "pending");
  const u = raw.toUpperCase();
  const isTable = orderType === "table";
  if (isTable) {
    if (u === "PLACED") return "pending";
    if (u === "PREPARING") return "preparing";
    if (u === "READY") return "ready";
    if (u === "SERVED" || u === "COMPLETED") return "served";
  }
  const l = raw.toLowerCase();
  if (l === "placed" || l === "pending" || l === "created" || l === "confirmed") return "pending";
  if (l === "accepted" || l === "preparing") return "preparing";
  if (l === "ready") return "ready";
  if (l === "served" || l === "completed") return "served";
  return l || "pending";
}

function enrichOrder(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDoc(id, data);
  const tn = data.tableNumber;
  const ot = data.orderType;
  const ps = data.paymentStatus;
  const tok = data.tokenNumber;
  const orderType = typeof ot === "string" ? ot : undefined;
  return {
    ...base,
    orderType,
    tableNumber:
      typeof tn === "number" ? tn : typeof tn === "string" ? Number(tn) || undefined : undefined,
    paymentStatus: typeof ps === "string" ? ps : undefined,
    tokenNumber: typeof tok === "number" && Number.isFinite(tok) ? tok : undefined,
    canonicalStatus: canonicalOrderStatus(String(base.status ?? ""), orderType)
  };
}

/**
 * Live listener on the full `orders` collection (per product spec). For large datasets,
 * replace with a narrower query + indexes.
 */
export function subscribeAllOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(staffDb, ORDERS_COLLECTION),
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
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
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

/** KDS: lifecycle `pending` / `preparing` plus legacy table `PLACED` / `PREPARING`. */
export const KITCHEN_KDS_STATUS_IN = ["pending", "preparing", "PLACED", "PREPARING"] as const;

/**
 * Live kitchen queue — `onSnapshot` (no pull-to-refresh required).
 * Composite: `status` ASC + `createdAt` DESC (`backend/firestore.indexes.json`).
 */
export function subscribeKitchenKdsOrders(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    where("status", "in", [...KITCHEN_KDS_STATUS_IN]),
    orderBy("createdAt", "desc"),
    limit(120)
  );
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

/** Cashier: served (dine-in) with payment still open. */
export const CASHIER_BILLING_STATUS_IN = ["served", "SERVED"] as const;
export const CASHIER_BILLING_PAYMENT_IN = ["pending", "PENDING"] as const;

/**
 * Live billing queue — `onSnapshot` (no refresh).
 * Composite: `status` + `paymentStatus` + `createdAt` (`backend/firestore.indexes.json`).
 */
export function subscribeCashierBillingQueue(
  onNext: (orders: StaffOrderRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(staffDb, ORDERS_COLLECTION),
    where("status", "in", [...CASHIER_BILLING_STATUS_IN]),
    where("paymentStatus", "in", [...CASHIER_BILLING_PAYMENT_IN]),
    orderBy("createdAt", "desc"),
    limit(80)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => enrichOrder(d.id, d.data() as Record<string, unknown>));
      const filtered = rows.filter(
        (o) =>
          o.canonicalStatus === "served" &&
          ["pending", "PENDING"].includes(String(o.paymentStatus ?? "").trim())
      );
      onNext(filtered);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

/** Table tickets: {@link confirmTableOrderPayment}. Lifecycle: `paymentStatus` → `paid` (rules). */
export async function markCashierOrderPaid(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  if (String(data.orderType ?? "") === "table") {
    await confirmTableOrderPayment(orderId);
    return;
  }
  await updateDoc(ref, {
    paymentStatus: "paid",
    updatedAt: serverTimestamp()
  });
}

/** Kitchen: `pending` → `preparing` (lifecycle) or `PLACED` → `PREPARING` (table tickets). */
export async function kitchenAcceptOrder(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, order.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const cur = String(data.status ?? "");
  if (orderType === "table") {
    if (cur !== "PLACED") {
      throw new Error("Accept is only available for PLACED table tickets.");
    }
    await updateDoc(ref, { status: "PREPARING", updatedAt: serverTimestamp() });
    return;
  }
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "pending") {
    throw new Error("Accept is only available for pending orders.");
  }
  await updateDoc(ref, { status: "preparing", updatedAt: serverTimestamp() });
}

export async function waiterAcceptOrder(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, order.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "pending") {
    throw new Error("Accept is only available for pending orders.");
  }
  if (orderType === "table") {
    await updateDoc(ref, { status: "PREPARING", updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { status: "preparing", updatedAt: serverTimestamp() });
  }
}

export async function kitchenMarkOrderReady(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, order.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "preparing") {
    throw new Error("Mark ready is only available while the order is preparing.");
  }
  if (orderType === "table") {
    await updateDoc(ref, { status: "READY", updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { status: "ready", updatedAt: serverTimestamp() });
  }
}

export async function waiterMarkServed(order: StaffOrderRow): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, order.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  const orderType = typeof data.orderType === "string" ? data.orderType : undefined;
  const cur = String(data.status ?? "");
  const canon = canonicalOrderStatus(cur, orderType);
  if (canon !== "ready") {
    throw new Error("Served is only available when the order is ready.");
  }
  if (orderType === "table") {
    await updateDoc(ref, { status: "SERVED", updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { status: "served", updatedAt: serverTimestamp() });
  }
}

export async function generateBillForOrder(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
  await updateDoc(ref, {
    paymentStatus: "REQUESTED",
    updatedAt: serverTimestamp()
  });
}

/** Walk-in / simple orders after service — marks paid without the table payment cloud fn. */
export async function markSimpleOrderPaid(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
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
  action: "accept" | "ready" | "served"
): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const data = snap.data() as Record<string, unknown>;
  if (data.orderType !== "table") {
    throw new Error("This action applies to table orders only.");
  }
  const status = String(data.status ?? "");
  if (action === "accept") {
    if (status !== "PLACED") throw new Error("Accept is only valid when status is PLACED.");
    await updateDoc(ref, { status: "PREPARING", updatedAt: serverTimestamp() });
    return;
  }
  if (action === "ready") {
    if (status !== "PREPARING") throw new Error("Ready is only valid when status is PREPARING.");
    await updateDoc(ref, { status: "READY", updatedAt: serverTimestamp() });
    return;
  }
  if (action === "served") {
    if (status !== "READY") throw new Error("Served is only valid when status is READY.");
    await updateDoc(ref, { status: "SERVED", updatedAt: serverTimestamp() });
  }
}

/** Advance one step on the shared SaaS lifecycle (`pending` → `accepted` → …). */
export async function advanceOrderLifecycle(orderId: string, target: OrderLifecycleStatus): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
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
  action: "accept" | "ready" | "served",
  role: StaffRoleId
): Promise<void> {
  const isPrivileged = role === "admin" || role === "manager";

  if (order.orderType === "table") {
    const st = String(order.status ?? "");
    if (action === "served" && (role === "waiter" || isPrivileged) && st === "READY") {
      await applyTableTicketAction(order.id, "served");
      return;
    }
    if (action === "accept" && (role === "kitchen" || isPrivileged) && st === "PLACED") {
      await applyTableTicketAction(order.id, "accept");
      return;
    }
    if (action === "ready" && (role === "kitchen" || isPrivileged) && st === "PREPARING") {
      await applyTableTicketAction(order.id, "ready");
      return;
    }
    throw new Error("Invalid table transition for this role.");
  }

  const cur = String(order.status ?? "pending").toLowerCase();

  if (role === "kitchen" || isPrivileged) {
    if (action === "accept") {
      if (cur === "pending" || cur === "created" || cur === "confirmed") {
        await advanceOrderLifecycle(order.id, "accepted");
        return;
      }
      if (cur === "accepted") {
        await advanceOrderLifecycle(order.id, "preparing");
        return;
      }
    }
    if (action === "ready" && cur === "preparing") {
      await advanceOrderLifecycle(order.id, "ready");
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
