/**
 * Customer-facing pipeline (aligned with staff lifecycle).
 * Steps 0–3: preparing → ready → out_for_delivery → delivered
 */
export const CUSTOMER_PIPELINE_STEPS = [
  {
    id: "preparing",
    label: "Preparing",
    description: "Kitchen is working on your order"
  },
  {
    id: "ready",
    label: "Ready",
    description: "Packed and ready for pickup or delivery"
  },
  {
    id: "out_for_delivery",
    label: "Out for delivery",
    description: "On the way to you"
  },
  {
    id: "delivered",
    label: "Delivered",
    description: "Order completed"
  }
] as const;

/**
 * Maps `orders.status` to the highlighted step index (0–3).
 * Early stages (pending, accepted, …) map to step 0 (preparing).
 */
export function customerOrderPipelineStepIndex(status: string): number {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "delivered" || s === "completed") return 3;
  if (s === "out_for_delivery" || s === "picked_up") return 2;
  if (s === "ready") return 1;
  return 0;
}

export function isCancelledOrderStatus(status: string): boolean {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");
  return s === "cancelled" || s === "canceled" || s === "rejected";
}

export function formatCustomerStatusLine(status: string): string {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "out_for_delivery") return "Out for delivery";
  if (s === "picked_up") return "Out for delivery";
  const map: Record<string, string> = {
    pending: "Order received",
    created: "Order received",
    confirmed: "Confirmed",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    delivered: "Delivered",
    completed: "Delivered",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    rejected: "Rejected"
  };
  return map[s] ?? status.replace(/_/g, " ");
}
