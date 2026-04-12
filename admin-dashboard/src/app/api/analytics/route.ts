import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import {
  ACTIVE_ORDER_STATUSES,
  bucketsToChartSeries,
  reduceOrdersForWindow,
  utcDayKeysDescending
} from "@/lib/analytics-aggregator";
import type { AdminAnalyticsPayload } from "@/lib/analytics-types";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Bounded read: recent orders only (covers chart + 30d revenue). */
const WINDOW_QUERY_LIMIT = 10_000;
const CHART_DAYS = 14;
const REVENUE_WINDOW_DAYS = 30;

export type { AdminAnalyticsPayload };

let analyticsCache: { key: string; expiresAt: number; payload: AdminAnalyticsPayload } | null = null;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_analytics_get", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  const now = new Date();
  const cacheKey = `${now.toISOString().slice(0, 13)}`;
  if (analyticsCache && analyticsCache.key === cacheKey && analyticsCache.expiresAt > Date.now()) {
    return Response.json(analyticsCache.payload, { status: 200, headers: CACHE_HEADERS });
  }

  try {
    const orders = adminDb.collection("orders");

    const revenueStart = new Date(startOfUtcDay(now));
    revenueStart.setUTCDate(revenueStart.getUTCDate() - REVENUE_WINDOW_DAYS);
    const tsStart = Timestamp.fromDate(revenueStart);

    const chartDayKeysOrdered = utcDayKeysDescending(CHART_DAYS);
    const chartDaySet = new Set(chartDayKeysOrdered);

    const [totalAgg, activeAgg, deliveredAgg, windowSnap] = await Promise.all([
      orders.count().get(),
      orders
        .where("status", "in", [...ACTIVE_ORDER_STATUSES])
        .count()
        .get(),
      orders.where("status", "==", "delivered").count().get(),
      orders.where("createdAt", ">=", tsStart).orderBy("createdAt", "desc").limit(WINDOW_QUERY_LIMIT).get()
    ]);

    const totalOrders = totalAgg.data().count;
    const activeOrders = activeAgg.data().count;
    const deliveredOrders = deliveredAgg.data().count;

    const reduced = reduceOrdersForWindow(windowSnap.docs, revenueStart.getTime(), chartDaySet);
    const revenueLast30Days = Math.round(reduced.revenueInWindow * 100) / 100;
    const { ordersPerDay, revenuePerDay } = bucketsToChartSeries(chartDayKeysOrdered, reduced.byDay);

    const windowTruncated = windowSnap.size >= WINDOW_QUERY_LIMIT;

    const payload: AdminAnalyticsPayload = {
      totalOrders,
      activeOrders,
      deliveredOrders,
      revenueLast30Days,
      ordersPerDay,
      revenuePerDay,
      windowTruncated,
      chartDays: CHART_DAYS,
      revenueWindowDays: REVENUE_WINDOW_DAYS
    };

    analyticsCache = {
      key: cacheKey,
      expiresAt: Date.now() + 45_000,
      payload
    };

    return Response.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/analytics]", message, error);
    return Response.json(
      { success: false, error: "Failed to load analytics." },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
