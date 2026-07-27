import { formatItemExtras } from "@shared/lib/format-item-extras";
import { normalizeOrderStatus, normalizePaymentStatus } from "@shared/utils/canonical-order-fields";

import type { StaffOrderRow } from "../../services/orders";
import { getOrderSourceMeta } from "./pos/order-source";
import {
  resolveKitchenQueueStatus,
  type KitchenOrder,
  type KitchenOrderItem
} from "./kitchen-kds";

function readIso(ts: StaffOrderRow["createdAt"]): string {
  const raw = ts as { toMillis?: () => number; seconds?: number } | null | undefined;
  if (raw && typeof raw.toMillis === "function") return new Date(raw.toMillis()).toISOString();
  if (raw && typeof raw.seconds === "number") {
    return new Date(raw.seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function readFieldIso(data: Record<string, unknown>, key: string): string | undefined {
  const raw = data[key];
  if (raw == null) return undefined;

  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }

  if (typeof raw === "object") {
    const o = raw as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof o.toDate === "function") {
      const d = o.toDate();
      return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
    }
    if (typeof o.toMillis === "function") {
      const ms = o.toMillis();
      return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
    }
    const sec = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : undefined;
    if (typeof sec === "number" && Number.isFinite(sec)) {
      return new Date(sec * 1000).toISOString();
    }
  }

  return undefined;
}

function resolveKitchenSource(order: StaffOrderRow): KitchenOrder["source"] {
  const meta = getOrderSourceMeta(order);
  if (meta.key === "swiggy") return "swiggy";
  if (meta.key === "zomato") return "zomato";
  if (meta.key === "dine_in" || meta.key === "waiter" || order.orderType === "table") return "dine-in";
  return "takeaway";
}

function resolveOrderNumber(order: StaffOrderRow): string {
  return typeof order.tokenNumber === "number" && order.tokenNumber > 0
    ? `#${order.tokenNumber}`
    : `#${order.id.slice(-6).toUpperCase()}`;
}

function mapItems(order: StaffOrderRow, withExtras: boolean): KitchenOrderItem[] {
  return order.items.map((it, index) => {
    const row = it as { id?: string; name: string; qty: number; price: number; modifications?: string[]; note?: string };
    const extras = withExtras
      ? formatItemExtras({ modifications: row.modifications, note: row.note })
      : undefined;
    return {
      productId: row.id || index,
      name: row.name,
      quantity: row.qty,
      price: row.price,
      ...(extras ? { notes: extras } : {})
    };
  });
}

export type KitchenHistoryOrder = {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  source: KitchenOrder["source"];
  orderType?: string;
  customerName?: string;
  waiterName?: string;
  total: number;
  historyStatus: "completed" | "cancelled";
  paymentStatus: string;
  createdAt: string;
  specialNotes?: string;
  acceptedAt?: string;
  preparingAt?: string;
  preparingStartedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  paidAt?: string;
  completedAt?: string;
  items: KitchenOrderItem[];
};

export type KitchenStage = "active" | "ready" | "history";

export function mapStaffOrderToKitchen(
  order: StaffOrderRow,
  data?: Record<string, unknown>
): KitchenOrder | null {
  const status = resolveKitchenQueueStatus(order);
  if (!status) return null;

  const raw = data ?? (order as StaffOrderRow & Record<string, unknown>);
  const tableLabel =
    order.tableName ??
    (typeof order.tableNumber === "number" ? String(order.tableNumber) : undefined);

  const preparingStartedAt =
    readFieldIso(raw, "preparingStartedAt") ?? readFieldIso(raw, "preparingAt");
  const preparingAt = readFieldIso(raw, "preparingAt") ?? preparingStartedAt;

  return {
    orderId: order.id,
    orderNumber: resolveOrderNumber(order),
    tableNumber: tableLabel,
    source: resolveKitchenSource(order),
    total: order.totalAmount,
    status,
    createdAt: readIso(order.createdAt),
    specialNotes: order.notes,
    customerName: order.customerName,
    orderType: order.orderType,
    waiterName: typeof raw.waiterName === "string" ? raw.waiterName : undefined,
    acceptedAt: readFieldIso(raw, "acceptedAt"),
    preparingAt,
    preparingStartedAt,
    readyAt: readFieldIso(raw, "readyAt"),
    items: mapItems(order, true)
  };
}

export function mapStaffOrderToHistory(
  order: StaffOrderRow,
  data: Record<string, unknown>
): KitchenHistoryOrder | null {
  const canon = normalizeOrderStatus(String(order.status ?? ""));
  if (canon !== "completed" && canon !== "cancelled") return null;

  const tableLabel =
    order.tableName ??
    (typeof order.tableNumber === "number" ? String(order.tableNumber) : undefined);

  return {
    orderId: order.id,
    orderNumber: resolveOrderNumber(order),
    tableNumber: tableLabel,
    source: resolveKitchenSource(order),
    orderType: order.orderType,
    customerName: order.customerName,
    waiterName: typeof data.waiterName === "string" ? data.waiterName : undefined,
    total: order.totalAmount,
    historyStatus: canon,
    paymentStatus: normalizePaymentStatus(String(order.paymentStatus ?? "")),
    createdAt: readIso(order.createdAt),
    specialNotes: order.notes,
    acceptedAt: readFieldIso(data, "acceptedAt"),
    preparingAt: readFieldIso(data, "preparingAt") ?? readFieldIso(data, "preparingStartedAt"),
    preparingStartedAt:
      readFieldIso(data, "preparingStartedAt") ?? readFieldIso(data, "preparingAt"),
    readyAt: readFieldIso(data, "readyAt"),
    deliveredAt: readFieldIso(data, "deliveredAt") ?? readFieldIso(data, "servedAt"),
    paidAt: readFieldIso(data, "paidAt"),
    completedAt: readFieldIso(data, "completedAt") ?? readFieldIso(data, "updatedAt"),
    items: mapItems(order, false)
  };
}

export function sortKitchenOrders(orders: KitchenOrder[]): KitchenOrder[] {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function stageProgressIso(order: KitchenOrder): string {
  if (order.status === "preparing") {
    return order.preparingStartedAt ?? order.preparingAt ?? order.createdAt;
  }
  if (order.status === "accepted" && order.acceptedAt) return order.acceptedAt;
  return order.createdAt;
}

export function readyWaitIso(order: KitchenOrder): string {
  return order.readyAt ?? order.createdAt;
}

export function historyDisplayStatus(order: KitchenHistoryOrder): string {
  if (order.historyStatus === "cancelled") return "Cancelled";
  if (order.paymentStatus === "paid") return "Paid";
  if (order.deliveredAt) return "Delivered";
  return "Completed";
}
