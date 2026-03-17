import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";

type DayBucket = { day: string; orders: number; revenue: number };
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" };
const ANALYTICS_DAYS = 30;
const MAX_ORDERS_FOR_TOP_ITEMS = 250;

type DashboardSummaryPayload = {
  totalOrders: number;
  revenue: number;
  dailySales: number;
  totalOrdersToday: number;
  revenueToday: number;
  onlineOrdersToday: number;
  storeOrdersToday: number;
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  topSellingItems: Array<{ name: string; qty: number }>;
  ordersPerDay: DayBucket[];
  revenuePerDay: Array<{ day: string; revenue: number }>;
};

let summaryCache: { expiresAt: number; payload: DashboardSummaryPayload } | null = null;

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_dashboard_summary", limit: 60, windowMs: 60_000 }
  });
  if (!secure.ok) {
    return secure.response;
  }
  if (summaryCache && summaryCache.expiresAt > Date.now()) {
    return Response.json(summaryCache.payload, { status: 200, headers: CACHE_HEADERS });
  }
  try {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setDate(todayStart.getDate() - 29);
    const monthStartKey = monthStart.toISOString().slice(0, 10);
    const todayDayKey = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(today.getDate() - (ANALYTICS_DAYS - 1));
    const todayKey = today.toISOString().slice(0, 10);

    const ordersSnap = await adminDb
      .collection("orders")
      .where("dayKey", ">=", monthStartKey)
      .where("dayKey", "<=", todayDayKey)
      .orderBy("dayKey", "asc")
      .get();

    const orders = ordersSnap.docs.map((doc) =>
      doc.data() as {
        total?: number;
        dayKey?: string;
        createdAt?: string;
        paymentMethod?: string;
        orderType?: string;
        status?: string;
      }
    );
    const totalOrders = orders.length;
    const revenue = orders.reduce((sum: number, order) => sum + Number(order.total ?? 0), 0);
    const dailySales = orders
      .filter((order) => String(order.dayKey ?? "").slice(0, 10) === todayKey)
      .reduce((sum: number, order) => sum + Number(order.total ?? 0), 0);

    const todaysOrders = orders.filter((order) => {
      const createdAt = order.createdAt ? new Date(order.createdAt) : null;
      return createdAt ? createdAt >= todayStart : false;
    });
    const totalOrdersToday = todaysOrders.length;
    const revenueToday = todaysOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const onlineOrdersToday = todaysOrders.filter((order) => order.paymentMethod === "card" || order.paymentMethod === "upi").length;
    const storeOrdersToday = todaysOrders.length - onlineOrdersToday;

    const weeklyRevenue = orders
      .filter((order) => {
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        return createdAt ? createdAt >= weekStart : false;
      })
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const monthlyRevenue = orders
      .filter((order) => {
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        return createdAt ? createdAt >= monthStart : false;
      })
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0);

    const days: Record<string, DayBucket> = {};
    for (let i = 0; i < ANALYTICS_DAYS; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      days[key] = { day: key, orders: 0, revenue: 0 };
    }
    orders.forEach((order) => {
      const day = String(order.dayKey ?? "").slice(0, 10);
      if (!days[day]) return;
      days[day].orders += 1;
      days[day].revenue += Number(order.total ?? 0);
    });

    const orderIds = ordersSnap.docs.slice(-MAX_ORDERS_FOR_TOP_ITEMS).map((doc) => doc.id);
    const orderItemDocs: Array<{ name?: string; qty?: number }> = [];
    const orderIdBatches: string[][] = [];
    for (let index = 0; index < orderIds.length; index += 30) {
      orderIdBatches.push(orderIds.slice(index, index + 30));
    }
    const batchSnaps = await Promise.all(
      orderIdBatches.map((batchIds) => adminDb.collection("order_items").where("orderId", "in", batchIds).get())
    );
    batchSnaps.forEach((batchSnap) => {
      batchSnap.docs.forEach((doc) => {
        orderItemDocs.push(doc.data() as { name?: string; qty?: number });
      });
    });
    const topItemsMap: Record<string, { name: string; qty: number }> = {};
    orderItemDocs.forEach((data) => {
      const name = String(data.name ?? "Unknown");
      if (!topItemsMap[name]) topItemsMap[name] = { name, qty: 0 };
      topItemsMap[name].qty += Number(data.qty ?? 0);
    });
    const topSellingItems = Object.values(topItemsMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const payload: DashboardSummaryPayload = {
      totalOrders,
      revenue,
      dailySales,
      totalOrdersToday,
      revenueToday,
      onlineOrdersToday,
      storeOrdersToday,
      dailyRevenue: revenueToday,
      weeklyRevenue,
      monthlyRevenue,
      topSellingItems,
      ordersPerDay: Object.values(days),
      revenuePerDay: Object.values(days).map((d) => ({ day: d.day, revenue: d.revenue }))
    };

    summaryCache = {
      payload,
      expiresAt: Date.now() + 30_000
    };

    return Response.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Dashboard summary error:", error);
    }
    return Response.json({ error: "Failed to load dashboard summary." }, { status: 500 });
  }
}
