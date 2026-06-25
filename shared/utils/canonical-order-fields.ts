/**
 * Normalize legacy Firestore order fields to canonical values.
 * Use on read (UI) and before write (persistence).
 */
import type { CanonicalOrderStatus, CanonicalPaymentStatus, OrderLineItem } from "../types/order";
import { CANONICAL_ORDER_STATUSES, CANONICAL_PAYMENT_STATUSES } from "../types/order";
import type { OrderCustomerFields } from "../types/customer";
import type { OrderTableFields } from "../types/table";
import { DINE_IN_ORDER_TYPES } from "../types/table";

const ORDER_BLOCKED = new Set(["cancelled", "canceled", "rejected", "void", "refunded"]);

/** Map any stored `status` string to a canonical lifecycle value. */
export function normalizeOrderStatus(raw: string | undefined | null): CanonicalOrderStatus {
  const s = String(raw ?? "new").trim().toLowerCase();
  if (ORDER_BLOCKED.has(s)) return "cancelled";
  if (s === "pending" || s === "created" || s === "confirmed" || s === "placed") return "new";
  if (s === "accepted") return "accepted";
  if (s === "preparing") return "preparing";
  if (s === "ready" || s === "done") return "ready";
  if (
    s === "completed" ||
    s === "served" ||
    s === "delivered" ||
    s === "out_for_delivery"
  ) {
    return "completed";
  }
  if ((CANONICAL_ORDER_STATUSES as readonly string[]).includes(s)) {
    return s as CanonicalOrderStatus;
  }
  // Uppercase restaurant legacy
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "PLACED") return "new";
  if (u === "PREPARING" || u === "ACCEPTED") return u === "ACCEPTED" ? "accepted" : "preparing";
  if (u === "READY") return "ready";
  if (u === "SERVED" || u === "COMPLETED") return "completed";
  return "new";
}

/** Map any stored `paymentStatus` to canonical pending | paid | refunded. */
export function normalizePaymentStatus(raw: string | undefined | null): CanonicalPaymentStatus {
  const s = String(raw ?? "pending").trim().toLowerCase();
  if (s === "paid") return "paid";
  if (s === "refunded" || s === "failed") return s === "refunded" ? "refunded" : "pending";
  if (s === "requested") return "pending";
  if ((CANONICAL_PAYMENT_STATUSES as readonly string[]).includes(s)) {
    return s as CanonicalPaymentStatus;
  }
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "PAID") return "paid";
  if (u === "REFUNDED") return "refunded";
  if (u === "PENDING" || u === "REQUESTED") return "pending";
  return "pending";
}

/** Status values for kitchen KDS realtime queries (active pipeline). */
export const KITCHEN_ACTIVE_STATUSES: readonly CanonicalOrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready"
];

/** Status values still visible to waiter after kitchen updates. */
export const WAITER_ACTIVE_STATUSES: readonly CanonicalOrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready"
];

export function isDineInOrderType(orderType: string | undefined | null): boolean {
  const ot = String(orderType ?? "").trim().toLowerCase();
  return (DINE_IN_ORDER_TYPES as readonly string[]).includes(ot);
}

/** Extract canonical table fields from a raw Firestore order document. */
export function extractTableFields(data: Record<string, unknown>): OrderTableFields {
  const tn = data.tableNumber;
  const tableNumber =
    typeof tn === "number" && Number.isFinite(tn)
      ? tn
      : typeof tn === "string"
        ? Number(tn) || undefined
        : undefined;
  const tableId = typeof data.tableId === "string" && data.tableId.trim() ? data.tableId.trim() : undefined;
  const tableName =
    typeof data.tableName === "string" && data.tableName.trim() ? data.tableName.trim() : undefined;
  return { tableId, tableNumber, tableName };
}

/** Extract canonical customer fields; prefers top-level, falls back to nested `customer`. */
export function extractCustomerFields(data: Record<string, unknown>): OrderCustomerFields {
  const topName = typeof data.customerName === "string" ? data.customerName.trim() : "";
  const topPhone =
    typeof data.customerPhone === "string"
      ? data.customerPhone.trim()
      : typeof data.phone === "string"
        ? data.phone.trim()
        : "";
  const cust = data.customer && typeof data.customer === "object" ? (data.customer as Record<string, unknown>) : {};
  const nestedName = typeof cust.name === "string" ? cust.name.trim() : "";
  const nestedPhone = typeof cust.phone === "string" ? cust.phone.trim() : "";
  return {
    customerName: topName || nestedName || undefined,
    customerPhone: topPhone || nestedPhone || undefined
  };
}

/** Build write payload with canonical top-level customer fields. */
export function buildCustomerWriteFields(params: {
  customerName?: string;
  customerPhone?: string;
}): OrderCustomerFields & { customer?: { name: string; phone: string; address?: string } } {
  const name = params.customerName?.trim() || "Guest";
  const phone = params.customerPhone?.trim() || "";
  return {
    customerName: name,
    customerPhone: phone,
    customer: { name, phone, address: "" as string }
  };
}

/** Parse embedded line items with consistent qty/price/modifiers. */
export function parseOrderLineItems(raw: unknown): OrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, idx) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const qty =
      typeof r.qty === "number"
        ? r.qty
        : typeof r.quantity === "number"
          ? r.quantity
          : 1;
    const price =
      typeof r.price === "number"
        ? r.price
        : typeof r.unitPrice === "number"
          ? r.unitPrice
          : 0;
    const item: OrderLineItem = {
      id:
        typeof r.id === "string"
          ? r.id
          : typeof r.productId === "string"
            ? r.productId
            : `line_${idx}`,
      name: typeof r.name === "string" ? r.name : "Item",
      qty: qty > 0 ? qty : 1,
      price
    };
    if (typeof r.productId === "string") item.productId = r.productId;
    if (typeof r.unitPrice === "number") item.unitPrice = r.unitPrice;
    if (typeof r.note === "string" && r.note.trim()) item.note = r.note.trim();
    if (Array.isArray(r.modifications)) {
      item.modifications = r.modifications
        .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
        .map((m) => m.trim());
    }
    return item;
  });
}

export function getOrderTotal(data: { total?: unknown; totalAmount?: unknown }): number {
  if (typeof data.total === "number" && Number.isFinite(data.total)) return data.total;
  if (typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount)) return data.totalAmount;
  return 0;
}

/** Whether an order is still in the active waiter/kitchen pipeline. */
export function isActivePipelineStatus(status: string | undefined | null): boolean {
  const canon = normalizeOrderStatus(status);
  return (WAITER_ACTIVE_STATUSES as readonly string[]).includes(canon);
}
