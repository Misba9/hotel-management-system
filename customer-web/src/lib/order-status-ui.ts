/**
 * Customer-facing labels and styles for `orders.status` (aligned with kitchen/delivery pipeline).
 */
export type OrderStatusPresentation = {
  label: string;
  /** Tailwind classes for badge (background + text) */
  badgeClass: string;
};

const DEFAULT_PRESENTATION: OrderStatusPresentation = {
  label: "Processing",
  badgeClass: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
};

/** Canonical + legacy statuses seen in Firestore / admin flows */
export function getOrderStatusPresentation(status: string): OrderStatusPresentation {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");
  switch (s) {
    case "pending":
    case "created":
    case "confirmed":
    case "accepted":
      return {
        label: s === "pending" ? "Pending" : s === "confirmed" ? "Confirmed" : s === "accepted" ? "Accepted" : "Received",
        badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
      };
    case "preparing":
      return {
        label: "Preparing",
        badgeClass: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
      };
    case "ready":
      return {
        label: "Ready",
        badgeClass: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100"
      };
    case "out_for_delivery":
    case "picked_up":
      return {
        label: "Out for delivery",
        badgeClass: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100"
      };
    case "delivered":
      return {
        label: "Delivered",
        badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
      };
    case "cancelled":
    case "canceled":
      return {
        label: "Cancelled",
        badgeClass: "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-100"
      };
    default:
      return {
        label: status.replace(/_/g, " ") || DEFAULT_PRESENTATION.label,
        badgeClass: DEFAULT_PRESENTATION.badgeClass
      };
  }
}

/** Allow cancel API + UI to stay in sync */
export const CANCELLABLE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "accepted",
  "preparing",
  "ready"
]);
