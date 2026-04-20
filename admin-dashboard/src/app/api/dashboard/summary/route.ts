import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "no-store" };

const ERROR_MESSAGE = "Failed to load dashboard summary.";

export type DashboardSummaryPayload = {
  ordersToday: number;
  pendingOrders: number;
  revenueToday: number;
  /** Orders currently in pipeline (not delivered / cancelled / rejected). */
  activeOrders: number;
  /** Documents in `customers` (synced from the customer app). */
  customers: number;
};

let summaryCache: { cacheKey: string; expiresAt: number; payload: DashboardSummaryPayload } | null = null;

function totalAmountOf(data: Record<string, unknown>): number {
  const n = Number(data.totalAmount);
  return Number.isFinite(n) ? n : 0;
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function serverError() {
  return Response.json({ success: false, error: ERROR_MESSAGE }, { status: 500, headers: CACHE_HEADERS });
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request, {
      rateLimit: { keyPrefix: "admin_dashboard_summary", limit: 120, windowMs: 60_000 }
    });
    if (!auth.ok) return auth.response;

    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const cacheDay = localDayKey(now);

    const cacheKey = cacheDay;

    if (summaryCache && summaryCache.cacheKey === cacheKey && summaryCache.expiresAt > Date.now()) {
      return Response.json(summaryCache.payload, { status: 200, headers: CACHE_HEADERS });
    }

    const tsStart = Timestamp.fromDate(todayStart);
    const tsEnd = Timestamp.fromDate(tomorrowStart);

    const activeStatuses = ["pending", "accepted", "preparing", "ready", "out_for_delivery"];

    const [todaySnap, pendingSnap, activeSnap, customersCountSnap] = await Promise.all([
      adminDb
        .collection("orders")
        .where("createdAt", ">=", tsStart)
        .where("createdAt", "<", tsEnd)
        .get(),
      adminDb.collection("orders").where("status", "==", "pending").get(),
      adminDb.collection("orders").where("status", "in", activeStatuses).get(),
      adminDb.collection("customers").count().get().catch(() => null)
    ]);

    let revenueToday = 0;
    for (const doc of todaySnap.docs) {
      revenueToday += totalAmountOf(doc.data() as Record<string, unknown>);
    }

    const customers = customersCountSnap?.data().count ?? 0;

    const payload: DashboardSummaryPayload = {
      ordersToday: todaySnap.size,
      pendingOrders: pendingSnap.size,
      revenueToday: Math.round(revenueToday * 100) / 100,
      activeOrders: activeSnap.size,
      customers
    };

    summaryCache = {
      cacheKey,
      payload,
      expiresAt: Date.now() + 45_000
    };

    return Response.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/dashboard/summary]", message, error);
    return serverError();
  }
}
