import type { StaffOrderRow } from "@/services/orders";
import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";
import {
  isOrderCancelled,
  isOrderCompleted,
  isOrderRefunded,
  isOwnOnlineOrder,
  resolveOrderSource,
  type OrderSourceKey,
  type OrderStatusFilter
} from "./pos/order-source";

export type { OrderSourceKey, OrderStatusFilter };

/** @deprecated Use OrderSourceKey */
export type OrderTypeFilter = OrderSourceKey;

/** @deprecated Use OrderStatusFilter */
export type PaymentFilter = "all" | "pending" | "paid";

export function isOrderPaid(paymentStatus?: string): boolean {
  return String(paymentStatus ?? "").toLowerCase() === "paid";
}

export function isOrderPendingPayment(paymentStatus?: string): boolean {
  const s = String(paymentStatus ?? "").toLowerCase();
  return s === "pending" || s === "requested";
}

export function filterCashierOrders(
  orders: StaffOrderRow[],
  opts: {
    search: string;
    source: OrderSourceKey;
    status: OrderStatusFilter;
  }
): StaffOrderRow[] {
  const q = opts.search.trim().toLowerCase();
  return orders.filter((order) => {
    if (opts.source === "waiter") {
      if (!isWaiterPosDineInOrder(order)) return false;
    } else if (opts.source === "online") {
      if (!isOwnOnlineOrder(order)) return false;
    } else {
      const src = resolveOrderSource(order);
      if (opts.source !== "all" && src !== opts.source) return false;
    }

    const paid = isOrderPaid(order.paymentStatus);
    const pending = isOrderPendingPayment(order.paymentStatus);
    const completed = isOrderCompleted(order);
    const cancelled = isOrderCancelled(order);
    const refunded = isOrderRefunded(order);
    const canonical = String(order.canonicalStatus ?? order.status ?? "").toLowerCase();

    if (opts.status === "paid" && !paid) return false;
    if (opts.status === "pending" && (paid || cancelled)) return false;
    if (
      opts.status === "accepted" &&
      canonical !== "accepted" &&
      canonical !== "placed" &&
      canonical !== "pending"
    )
      return false;
    if (opts.status === "preparing" && canonical !== "preparing") return false;
    if (opts.status === "ready" && canonical !== "ready") return false;
    if (opts.status === "picked_up" && canonical !== "picked_up" && canonical !== "picked") return false;
    if (opts.status === "delivered" && canonical !== "delivered") return false;
    if (
      opts.status === "received" &&
      !["placed", "pending", "accepted", "received"].includes(canonical)
    )
      return false;
    if (opts.status === "served" && canonical !== "served") return false;
    if (opts.status === "completed" && !completed) return false;
    if (opts.status === "cancelled" && !cancelled) return false;
    if (opts.status === "refunded" && !refunded) return false;

    if (!q) return true;
    const id = order.id.toLowerCase();
    const table = typeof order.tableNumber === "number" ? String(order.tableNumber) : "";
    const token = typeof order.tokenNumber === "number" ? String(order.tokenNumber) : "";
    const customer = String((order as StaffOrderRow & { customerName?: string }).customerName ?? order.customer?.name ?? "").toLowerCase();
    const phone = String((order as StaffOrderRow & { phone?: string }).phone ?? order.customer?.phone ?? "").toLowerCase();
    return id.includes(q) || table.includes(q) || token.includes(q) || customer.includes(q) || phone.includes(q);
  });
}

export function formatOrderTypeLabel(orderType?: string): string {
  const fake = { orderType } as StaffOrderRow;
  const src = resolveOrderSource(fake);
  const labels: Record<OrderSourceKey, string> = {
    all: "All",
    waiter: "Waiter",
    dine_in: "Dine-In",
    parcel: "Parcel",
    swiggy: "Swiggy",
    zomato: "Zomato",
    website: "Website",
    qr: "QR Order",
    phone: "Phone",
    online: "Online"
  };
  return labels[src];
}

export function kitchenStatusLabel(status?: string, canonical?: string): string {
  const c = String(canonical ?? status ?? "").toLowerCase();
  if (c === "preparing" || c === "placed") return "Preparing";
  if (c === "ready") return "Ready";
  if (c === "served" || c === "completed") return "Served";
  if (c === "done") return "Done";
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "—";
}
