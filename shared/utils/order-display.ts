import { KITCHEN_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "../constants/order-source";
import { normalizeOrderStatus, normalizePaymentStatus } from "./canonical-order-fields";

export function formatKitchenStatusLabel(status: string | undefined | null): string {
  const canon = normalizeOrderStatus(status);
  return KITCHEN_STATUS_LABELS[canon] ?? canon;
}

export function formatPaymentStatusLabel(status: string | undefined | null): string {
  const canon = normalizePaymentStatus(status);
  return PAYMENT_STATUS_LABELS[canon] ?? canon;
}

export function formatOrderNumber(order: {
  id: string;
  tokenNumber?: number;
}): string {
  if (typeof order.tokenNumber === "number" && order.tokenNumber > 0) {
    return `#${order.tokenNumber}`;
  }
  return `#${order.id.slice(-6).toUpperCase()}`;
}

export function formatTableLabel(order: {
  tableName?: string;
  tableNumber?: number;
  tableId?: string;
}): string {
  if (order.tableName?.trim()) return order.tableName.trim();
  if (typeof order.tableNumber === "number" && Number.isFinite(order.tableNumber)) {
    return `Table ${order.tableNumber}`;
  }
  if (order.tableId?.trim()) return `Table ${order.tableId.trim().slice(-4).toUpperCase()}`;
  return "—";
}
