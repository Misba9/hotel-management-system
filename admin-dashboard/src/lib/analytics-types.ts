export type AdminAnalyticsPayload = {
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  /** Sum of order totals in the revenue window (`createdAt` filter) — same as orders.reduce((s, o) => s + total, 0). */
  revenueLast30Days: number;
  ordersToday: number;
  revenueToday: number;
  topProducts: Array<{ name: string; sold: number; revenue: number }>;
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
  windowTruncated: boolean;
  chartDays: number;
  revenueWindowDays: number;
};
