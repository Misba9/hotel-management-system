export type AdminAnalyticsPayload = {
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  revenueLast30Days: number;
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
  windowTruncated: boolean;
  chartDays: number;
  revenueWindowDays: number;
};
