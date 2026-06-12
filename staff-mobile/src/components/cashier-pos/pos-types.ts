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
  discount?: number;
};

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
  | "cancelled";

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
