import type { StaffOrderRow } from "../../../services/orders";

/** Normalized order channel — derived from Firestore fields (no API changes). */
export type OrderSourceKey =
  | "all"
  | "waiter"
  | "dine_in"
  | "parcel"
  | "swiggy"
  | "zomato"
  | "website"
  | "qr"
  | "phone"
  | "online";

export type OrderStatusFilter =
  | "all"
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "paid"
  | "completed"
  | "cancelled"
  | "refunded"
  | "picked_up"
  | "delivered"
  | "received"
  | "served";

export type OrderSourceMeta = {
  key: OrderSourceKey;
  label: string;
  emoji: string;
  color: string;
};

export const ORDER_SOURCE_META: Record<Exclude<OrderSourceKey, "all">, OrderSourceMeta> = {
  waiter: { key: "waiter", label: "Waiter", emoji: "🟢", color: "#22C55E" },
  dine_in: { key: "dine_in", label: "Dine-In", emoji: "🟢", color: "#22C55E" },
  parcel: { key: "parcel", label: "Parcel", emoji: "📦", color: "#F97316" },
  swiggy: { key: "swiggy", label: "Swiggy", emoji: "🟠", color: "#F97316" },
  zomato: { key: "zomato", label: "Zomato", emoji: "🟡", color: "#E23744" },
  website: { key: "website", label: "Website", emoji: "🔵", color: "#3B82F6" },
  qr: { key: "qr", label: "QR Order", emoji: "📱", color: "#8B5CF6" },
  phone: { key: "phone", label: "Phone", emoji: "📞", color: "#06B6D4" },
  online: { key: "online", label: "Online", emoji: "🌐", color: "#0EA5E9" }
};

/** Customer website / app channels — grouped under the cashier ONLINE tab. */
const OWN_ONLINE_SOURCES = new Set<Exclude<OrderSourceKey, "all">>(["online", "website", "qr", "phone"]);

export function isOwnOnlineOrder(order: StaffOrderRow): boolean {
  return OWN_ONLINE_SOURCES.has(resolveOrderSource(order));
}

function readString(order: StaffOrderRow, ...keys: string[]): string {
  const raw = order as StaffOrderRow & Record<string, unknown>;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  return "";
}

/** Resolve channel from `orderType`, `source`, `platform`, `channel` fields. */
export function resolveOrderSource(order: StaffOrderRow): Exclude<OrderSourceKey, "all"> {
  const source = readString(order, "source", "platform", "channel", "aggregator");
  const type = readString(order, "orderType", "type");

  if (source.includes("swiggy")) return "swiggy";
  if (source.includes("zomato")) return "zomato";
  if (source.includes("qr")) return "qr";
  if (source.includes("phone") || source.includes("call")) return "phone";
  if (source.includes("website") || source.includes("storefront") || source === "customer-web") return "website";

  if (type.includes("swiggy")) return "swiggy";
  if (type.includes("zomato")) return "zomato";
  if (type === "dine_in" || type === "table" || type === "dine-in" || type === "dinein") return "dine_in";
  if (type === "parcel" || type === "takeaway" || type === "take_away") return "parcel";
  if (type === "online" || type === "delivery") return "online";
  if (source === "pos" || source === "dine_in") return "dine_in";

  return type ? "online" : "parcel";
}

export function getOrderSourceMeta(order: StaffOrderRow): OrderSourceMeta {
  return ORDER_SOURCE_META[resolveOrderSource(order)];
}

export function isOrderCancelled(order: StaffOrderRow): boolean {
  const s = String(order.status ?? "").toLowerCase();
  return s === "cancelled" || s === "rejected" || s === "void";
}

export function isOrderRefunded(order: StaffOrderRow): boolean {
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  const s = String(order.status ?? "").toLowerCase();
  return ps === "refunded" || s === "refunded";
}

export function isOrderCompleted(order: StaffOrderRow): boolean {
  const s = String(order.status ?? "").toLowerCase();
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  return s === "completed" || s === "delivered" || ps === "paid";
}
