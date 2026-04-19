/**
 * Pure helpers: bucket orders by day, sum revenue — used by /api/analytics (Admin SDK query + reduce).
 */

export const ACTIVE_ORDER_STATUSES = [
  "pending",
  "created",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery"
] as const;

/** Last N calendar days as UTC `YYYY-MM-DD` (matches typical `dayKey` on orders). */
export function utcDayKeysDescending(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    out.push(x.toISOString().slice(0, 10));
  }
  return out.reverse();
}

export function utcDayKeyFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function orderAmount(data: Record<string, unknown>): number {
  const t = data.total;
  const ta = data.totalAmount;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof ta === "number" && Number.isFinite(ta)) return ta;
  return 0;
}

export function parseCreatedMs(data: Record<string, unknown>): number | null {
  const v = data.createdAt;
  if (v && typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export type DayBucket = { day: string; orders: number; revenue: number };

export type WindowReduceResult = {
  revenueInWindow: number;
  /** UTC day key -> metrics */
  byDay: Map<string, { orders: number; revenue: number }>;
  docsConsidered: number;
};

/**
 * Single pass `reduce()` over order docs: revenue in time window + per-day buckets for chart.
 */
export function reduceOrdersForWindow(
  rows: Array<{ id: string; data: () => Record<string, unknown> }>,
  windowStartMs: number,
  chartDayKeys: Set<string>
): WindowReduceResult {
  let revenueInWindow = 0;
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const k of chartDayKeys) {
    byDay.set(k, { orders: 0, revenue: 0 });
  }

  let docsConsidered = 0;
  for (const doc of rows) {
    const raw = doc.data();
    const created = parseCreatedMs(raw);
    if (created === null || created < windowStartMs) continue;
    docsConsidered += 1;
    const amt = orderAmount(raw);
    revenueInWindow += amt;
    const dk = utcDayKeyFromMs(created);
    if (chartDayKeys.has(dk)) {
      const b = byDay.get(dk) ?? { orders: 0, revenue: 0 };
      b.orders += 1;
      b.revenue += amt;
      byDay.set(dk, b);
    }
  }

  return { revenueInWindow, byDay, docsConsidered };
}

export function bucketsToChartSeries(chartDayKeysOrdered: string[], byDay: Map<string, { orders: number; revenue: number }>) {
  const ordersPerDay = chartDayKeysOrdered.map((day) => ({
    day,
    orders: byDay.get(day)?.orders ?? 0
  }));
  const revenuePerDay = chartDayKeysOrdered.map((day) => ({
    day,
    revenue: Math.round((byDay.get(day)?.revenue ?? 0) * 100) / 100
  }));
  return { ordersPerDay, revenuePerDay };
}

export type TopProductRow = { name: string; sold: number; revenue: number };

/**
 * Aggregate line items from orders in the same time window as {@link reduceOrdersForWindow}.
 * `revenue` per line ≈ price × qty (same spirit as `orders.reduce((sum, o) => sum + o.total, 0)` at order level).
 */
export function aggregateTopProducts(
  rows: Array<{ data: () => Record<string, unknown> }>,
  windowStartMs: number,
  limit: number
): TopProductRow[] {
  const map = new Map<string, { sold: number; revenue: number }>();

  for (const doc of rows) {
    const raw = doc.data();
    const created = parseCreatedMs(raw);
    if (created === null || created < windowStartMs) continue;

    const items = raw.items;
    if (!Array.isArray(items)) continue;

    for (const line of items) {
      if (!line || typeof line !== "object") continue;
      const o = line as Record<string, unknown>;
      const name = String(o.name ?? o.productName ?? "Item").trim() || "Item";
      const qtyRaw = o.quantity ?? o.qty;
      const qty = typeof qtyRaw === "number" && qtyRaw > 0 ? qtyRaw : 1;
      const priceRaw = o.price ?? o.unitPrice;
      const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;
      const prev = map.get(name) ?? { sold: 0, revenue: 0 };
      prev.sold += qty;
      prev.revenue += price * qty;
      map.set(name, prev);
    }
  }

  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      sold: Math.round(v.sold * 100) / 100,
      revenue: Math.round(v.revenue * 100) / 100
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Math.max(1, limit));
}

/** Orders whose `createdAt` falls on today's UTC calendar day (within the chart bucket set). */
export function ordersTodayFromDayMap(byDay: Map<string, { orders: number; revenue: number }>): number {
  const todayKey = utcDayKeyFromMs(Date.now());
  return byDay.get(todayKey)?.orders ?? 0;
}

/** Revenue for today's UTC day within chart buckets. */
export function revenueTodayFromDayMap(byDay: Map<string, { orders: number; revenue: number }>): number {
  const todayKey = utcDayKeyFromMs(Date.now());
  return Math.round((byDay.get(todayKey)?.revenue ?? 0) * 100) / 100;
}
