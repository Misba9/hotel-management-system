import type { StaffOrderRow } from "@/services/orders";
import type { PlatformTab } from "@/lib/pos/cashier-pos-store";
import { resolveOrderSource } from "@/lib/pos/order-source";
import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";
import { normalizeOrderStatus, extractCustomerFields } from "@shared/utils/canonical-order-fields";

/** Cashier order pipeline status for Swiggy / Zomato / Online / Waiter channels. */
export type WorkflowStatus = "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled"
];

export const WORKFLOW_STATUS_META: Record<
  WorkflowStatus,
  { label: string; color: string; bg: string }
> = {
  new: { label: "New", color: "#2563EB", bg: "#DBEAFE" },
  accepted: { label: "Accepted", color: "#EA580C", bg: "#FFEDD5" },
  preparing: { label: "Preparing", color: "#CA8A04", bg: "#FEF9C3" },
  ready: { label: "Ready", color: "#16A34A", bg: "#DCFCE7" },
  completed: { label: "Completed", color: "#166534", bg: "#BBF7D0" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" }
};

const CHANNEL_PLATFORMS = new Set<PlatformTab>(["swiggy", "zomato", "online", "waiter"]);

export function isChannelPlatform(platform: PlatformTab): boolean {
  return CHANNEL_PLATFORMS.has(platform);
}

export function orderBelongsToPlatform(order: StaffOrderRow, platform: PlatformTab): boolean {
  if (platform === "waiter") return isWaiterPosDineInOrder(order);
  if (platform === "online") {
    const src = resolveOrderSource(order);
    return src === "online" || src === "website" || src === "qr" || src === "phone";
  }
  return resolveOrderSource(order) === platform;
}

export function resolveWorkflowStatus(order: StaffOrderRow): WorkflowStatus {
  const canon = normalizeOrderStatus(String(order.status ?? ""));
  if (canon === "cancelled") return "cancelled";
  if (canon === "completed") return "completed";
  if (canon === "ready") return "ready";
  if (canon === "preparing") return "preparing";
  if (canon === "accepted") return "accepted";
  return "new";
}

export function filterOrdersByWorkflow(
  orders: StaffOrderRow[],
  status: WorkflowStatus | "all"
): StaffOrderRow[] {
  if (status === "all") return orders;
  return orders.filter((o) => resolveWorkflowStatus(o) === status);
}

export function countWorkflowStatuses(orders: StaffOrderRow[]): Record<WorkflowStatus, number> {
  const counts: Record<WorkflowStatus, number> = {
    new: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0
  };
  for (const o of orders) {
    counts[resolveWorkflowStatus(o)] += 1;
  }
  return counts;
}

export function formatOrderTime(order: StaffOrderRow): string {
  const ts = order.createdAt as { toMillis?: () => number; seconds?: number } | null;
  if (ts && typeof ts.toMillis === "function") {
    return new Date(ts.toMillis()).toLocaleString();
  }
  if (ts && typeof ts.seconds === "number") {
    return new Date(ts.seconds * 1000).toLocaleString();
  }
  return "—";
}

export function orderCustomerName(order: StaffOrderRow): string {
  const fields = extractCustomerFields(order as unknown as Record<string, unknown>);
  return fields.customerName?.trim() || order.customer?.name?.trim() || "Guest";
}

export function orderCustomerPhone(order: StaffOrderRow): string {
  const fields = extractCustomerFields(order as unknown as Record<string, unknown>);
  return fields.customerPhone?.trim() || order.customer?.phone?.trim() || "—";
}

export function orderDisplayId(order: StaffOrderRow): string {
  if (typeof order.tokenNumber === "number" && order.tokenNumber > 0) {
    return `#${order.tokenNumber}`;
  }
  return `#${order.id.slice(-6).toUpperCase()}`;
}
