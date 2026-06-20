export type MenuItemDoc = {
  id: string;
  name: string;
  price: number;
  category?: string;
  categoryId?: string;
  image?: string | null;
  imageUrl?: string | null;
  available?: boolean;
  stockQty?: number;
  rating?: number;
  isBestSeller?: boolean;
};

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  variant?: string;
  note?: string;
  modifications?: string[];
  discount?: number;
};

/** Common per-item add-ons for juice / beverage orders. */
export const POS_ITEM_MODIFICATIONS = [
  "Extra Sugar",
  "Less Sugar",
  "No Sugar",
  "Extra Ice",
  "Less Ice",
  "No Ice",
  "Extra Milk",
  "No Milk"
] as const;

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

/** @deprecated */
export type OrderTypeFilter = OrderSourceKey;
/** @deprecated */
export type PaymentFilter = "all" | "pending" | "paid";

export type PosOrderFilter = {
  source: OrderSourceKey;
  status: OrderStatusFilter;
  search: string;
};

export type CashierDashboardMetrics = {
  todaySales: number;
  todayOrders: number;
  dineInCount: number;
  parcelCount: number;
  swiggyCount: number;
  zomatoCount: number;
  onlineCount: number;
  pendingCount: number;
  kitchenCount: number;
  deliveryCount: number;
  activeTables: number;
  pendingBills: number;
  cashDrawer: number;
  upiTotal: number;
  cardTotal: number;
  averageBill: number;
};

export type TableFilter = "all" | "free" | "busy" | "billing" | "reserved" | "parcel";

export type MenuQuickFilter = "all" | "favorites" | "popular" | "recent" | "combos";

export type DiscountMode = "percent" | "flat" | "coupon" | "promo";

export type SplitPaymentLine = {
  method: string;
  amount: number;
};

export type PosNotification = {
  id: string;
  title: string;
  body: string;
  time: Date;
  kind: "kitchen" | "payment" | "table" | "stock" | "swiggy" | "zomato" | "refund" | "manager";
};

export type PosPanelTab = "orders" | "menu" | "bill";

/** Cashier counter order channels — aggregators + dine-in/parcel only. */
export type PosOrderChannel = "dine_in" | "parcel" | "swiggy" | "zomato";

export type PosOrderChannelMeta = {
  id: PosOrderChannel;
  label: string;
  emoji: string;
  color: string;
};

export const POS_ORDER_CHANNELS: PosOrderChannelMeta[] = [
  { id: "dine_in", label: "Dine-In", emoji: "🪑", color: "#22C55E" },
  { id: "parcel", label: "Parcel", emoji: "🛍", color: "#FF7A00" },
  { id: "swiggy", label: "Swiggy", emoji: "🛵", color: "#F97316" },
  { id: "zomato", label: "Zomato", emoji: "🍔", color: "#E23744" }
];

export function channelToBackendOrder(channel: PosOrderChannel): {
  orderType: "dine_in" | "parcel" | "online";
  source?: string;
} {
  if (channel === "dine_in") return { orderType: "dine_in" };
  if (channel === "parcel") return { orderType: "parcel" };
  return { orderType: "online", source: channel };
}
