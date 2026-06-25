import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { staffDb } from "@/lib/staff-db";
import { assertValidOrderId } from "@/lib/firestore-path";
import {
  calculateBillTotals,
  printFinalInvoice,
  staffOrderItemsToCartLines,
  type PaymentMethodId
} from "@/services/restaurant-orders";
import { printKitchenKot } from "@/services/kitchen-kot-print";
import { markKitchenTicketPrinted, ORDERS_COLLECTION, type StaffOrderRow } from "@/services/orders";
import { mapOrderDoc as mapOrderDocFromCore } from "@/services/firestore-orders-core.js";
import { resolveWorkflowStatus } from "@/lib/pos/order-workflow-status";

function enrichFromSnap(id: string, data: Record<string, unknown>): StaffOrderRow {
  const base = mapOrderDocFromCore(id, data);
  const ot = data.orderType;
  const orderType = typeof ot === "string" ? ot : undefined;
  const rawStatus = String(base.status ?? "");
  return {
    ...base,
    orderType,
    tableNumber: typeof data.tableNumber === "number" ? data.tableNumber : undefined,
    tableName: typeof data.tableName === "string" ? data.tableName : undefined,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined,
    tokenNumber: typeof data.tokenNumber === "number" ? data.tokenNumber : undefined,
    canonicalStatus: rawStatus.toLowerCase(),
    printed: data.printed === true
  } as StaffOrderRow;
}

async function loadOrder(orderId: string): Promise<StaffOrderRow> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  return enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
}

/** NEW → ACCEPTED: print KOT and send to kitchen queue. */
export async function acceptChannelOrder(orderId: string, acceptedByUid?: string): Promise<StaffOrderRow> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const order = enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
  if (resolveWorkflowStatus(order) !== "new") {
    throw new Error("Only new orders can be accepted.");
  }

  const ts = serverTimestamp();
  await updateDoc(ref, {
    status: "accepted",
    acceptedAt: ts,
    sentToKitchenAt: ts,
    kitchenNotified: true,
    ...(acceptedByUid ? { acceptedBy: acceptedByUid } : {}),
    updatedAt: ts
  });

  const accepted = await loadOrder(orderId);
  try {
    await printKitchenKot(accepted, { source: "auto" });
    await markKitchenTicketPrinted(orderId);
  } catch {
    /* Order accepted — print failure must not roll back acceptance */
  }
  return accepted;
}

/** NEW → CANCELLED with reason. */
export async function rejectChannelOrder(
  orderId: string,
  reason: string,
  rejectedByUid?: string
): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const order = enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
  if (resolveWorkflowStatus(order) !== "new") {
    throw new Error("Only new orders can be rejected.");
  }

  await updateDoc(ref, {
    status: "cancelled",
    cancelReason: reason.trim() || "Rejected by cashier",
    cancelledAt: serverTimestamp(),
    ...(rejectedByUid ? { cancelledBy: rejectedByUid } : {}),
    updatedAt: serverTimestamp()
  });
}

/** ACCEPTED → PREPARING (kitchen). */
export async function markChannelOrderPreparing(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const order = enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
  const ws = resolveWorkflowStatus(order);
  if (ws === "preparing") return;
  if (ws !== "accepted") {
    throw new Error("Order must be accepted before preparing.");
  }
  await updateDoc(ref, {
    status: "preparing",
    preparingAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** PREPARING → READY (kitchen). */
export async function markChannelOrderReady(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const order = enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
  if (resolveWorkflowStatus(order) !== "preparing") {
    throw new Error("Order must be preparing before marking ready.");
  }
  await updateDoc(ref, {
    status: "ready",
    readyAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** READY → COMPLETED (cashier — aggregators). */
export async function completeChannelOrder(orderId: string): Promise<void> {
  const ref = doc(staffDb, ORDERS_COLLECTION, assertValidOrderId(orderId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found");
  const order = enrichFromSnap(snap.id, snap.data() as Record<string, unknown>);
  if (resolveWorkflowStatus(order) !== "ready") {
    throw new Error("Order must be ready before completing.");
  }
  await updateDoc(ref, {
    status: "completed",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/** Print customer bill for channel order. */
export async function printChannelOrderBill(
  order: StaffOrderRow,
  taxPercent: number,
  paymentMethod: PaymentMethodId = "cash"
): Promise<void> {
  const lines = staffOrderItemsToCartLines(order.items);
  const { subtotal, taxAmount, grandTotal, taxPercent: tax } = calculateBillTotals(
    order.totalAmount,
    taxPercent
  );
  const token =
    typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";

  await printFinalInvoice({
    orderIdShort: order.id.slice(0, 10).toUpperCase(),
    tableLabel: order.tableName ?? "Counter",
    tokenLabel: token,
    items: lines,
    subtotal,
    taxPercent: tax,
    taxAmount,
    grandTotal,
    paymentMethodLabel: paymentMethod
  });
}
