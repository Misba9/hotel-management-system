/** Canonical order channel keys stored in `orders/{id}.source` or derived from `orderType`. */
export const ORDER_SOURCE_KEYS = [
  "waiter",
  "dine_in",
  "parcel",
  "swiggy",
  "zomato",
  "website",
  "online"
] as const;

export type OrderSourceKey = (typeof ORDER_SOURCE_KEYS)[number];

export type OrderSourceMeta = {
  key: OrderSourceKey;
  label: string;
  emoji: string;
  color: string;
};

export const ORDER_SOURCE_META: Record<OrderSourceKey, OrderSourceMeta> = {
  waiter: { key: "waiter", label: "Waiter", emoji: "🟢", color: "#22C55E" },
  dine_in: { key: "dine_in", label: "Dine-In", emoji: "🟢", color: "#22C55E" },
  parcel: { key: "parcel", label: "Parcel", emoji: "📦", color: "#F97316" },
  swiggy: { key: "swiggy", label: "Swiggy", emoji: "🟠", color: "#F97316" },
  zomato: { key: "zomato", label: "Zomato", emoji: "🟡", color: "#E23744" },
  website: { key: "website", label: "Website", emoji: "🔵", color: "#3B82F6" },
  online: { key: "online", label: "Online", emoji: "🌐", color: "#0EA5E9" }
};

export const KITCHEN_STATUS_LABELS: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled"
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded"
};
