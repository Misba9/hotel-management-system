import { useMemo, useState } from "react";
import type { StaffOrderRow } from "@/services/orders";
import type { MenuProduct } from "@/services/products";
import type { StaffDirectoryRow } from "./types";

type Props = {
  orders: StaffOrderRow[];
  products: MenuProduct[];
  staff: StaffDirectoryRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type Period = "daily" | "weekly" | "monthly";

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function money(v: number): string {
  return `₹${Math.max(0, v).toFixed(2)}`;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function startDateForPeriod(period: Period): Date {
  const now = new Date();
  const d = new Date(now);
  if (period === "daily") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "weekly") {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function BarChart({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <article className="rounded-xl border border-theme-border bg-theme-card p-3">
      <p className="mb-2 text-sm font-semibold text-theme-text-primary">{title}</p>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-theme-text-secondary">No data</p>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-theme-text-secondary">{row.label}</span>
                <span className="font-semibold text-theme-text-primary">{row.value.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded bg-theme-hover">
                <div
                  className="h-2 rounded bg-theme-primary"
                  style={{ width: `${Math.min(100, Math.round((row.value / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

export function ManagerReportsModule({ orders, products, staff, loading, lastUpdated }: Props) {
  const [period, setPeriod] = useState<Period>("daily");
  const start = useMemo(() => startDateForPeriod(period), [period]);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const created = toDate(order.createdAt);
        return created != null && created >= start;
      }),
    [orders, start]
  );

  const paidOrders = useMemo(
    () =>
      filtered.filter((order) => {
        const status = (order.canonicalStatus || order.status || "").toString().toLowerCase();
        const payment = (order.paymentStatus ?? "").toString().toLowerCase();
        return payment === "paid" || status === "completed" || status === "delivered";
      }),
    [filtered]
  );

  const metrics = useMemo(() => {
    const sales = paidOrders.length;
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
    const discounts = filtered.reduce((sum, order) => sum + Number((order as Record<string, unknown>).discountAmount ?? 0), 0);
    const refunds = filtered.reduce(
      (sum, order) =>
        sum +
        Number((order as Record<string, unknown>).refundAmount ?? (order as Record<string, unknown>).refundedAmount ?? 0),
      0
    );
    const gst = filtered.reduce((sum, order) => {
      const data = order as Record<string, unknown>;
      return sum + Number(data.taxAmount ?? data.tax ?? 0);
    }, 0);
    const aov = sales > 0 ? revenue / sales : 0;
    return { sales, revenue, discounts, refunds, gst, aov };
  }, [filtered, paidOrders]);

  const productMap = useMemo(() => {
    const byId = new Map<string, MenuProduct>();
    const byName = new Map<string, MenuProduct>();
    for (const p of products) {
      byId.set(p.id, p);
      byName.set(p.name.toLowerCase(), p);
    }
    return { byId, byName };
  }, [products]);

  const bestSellingItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const order of filtered) {
      for (const item of order.items) {
        const key = item.id || item.name.toLowerCase();
        const slot = map.get(key) ?? { name: item.name, qty: 0, revenue: 0 };
        slot.qty += item.qty;
        slot.revenue += item.qty * item.price;
        map.set(key, slot);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [filtered]);

  const categorySales = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of filtered) {
      for (const item of order.items) {
        const product = productMap.byId.get(item.id) ?? productMap.byName.get(item.name.toLowerCase());
        const category = product?.category ?? "Uncategorized";
        map.set(category, (map.get(category) ?? 0) + item.qty * item.price);
      }
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered, productMap]);

  const peakHours = useMemo(() => {
    const map = new Map<number, number>();
    for (const order of filtered) {
      const created = toDate(order.createdAt);
      if (!created) continue;
      const hour = created.getHours();
      map.set(hour, (map.get(hour) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([hour, count]) => ({ label: `${hour.toString().padStart(2, "0")}:00`, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const kitchenPerformance = useMemo(() => {
    const active = filtered.filter((order) => ["new", "accepted", "preparing", "ready", "completed", "delivered"].includes((order.canonicalStatus || order.status || "").toString().toLowerCase()));
    let measured = 0;
    let totalPrepMinutes = 0;
    let delayed = 0;
    for (const order of active) {
      const data = order as Record<string, unknown>;
      const started = toDate(data.acceptedAt) ?? toDate(data.preparingAt) ?? toDate(order.createdAt);
      const ended = toDate(data.readyAt) ?? toDate(data.completedAt) ?? toDate(order.updatedAt);
      if (!started || !ended) continue;
      const mins = Math.max(0, Math.floor((ended.getTime() - started.getTime()) / 60000));
      totalPrepMinutes += mins;
      measured += 1;
      if (mins > 20) delayed += 1;
    }
    const avg = measured > 0 ? totalPrepMinutes / measured : 0;
    const onTimeRate = measured > 0 ? ((measured - delayed) / measured) * 100 : 0;
    return { avgPrep: avg, delayed, measured, onTimeRate };
  }, [filtered]);

  const waiterPerformance = useMemo(() => {
    const waiterNameByUid = new Map<string, string>();
    for (const member of staff) {
      if (member.role === "waiter") waiterNameByUid.set(member.uid, member.name);
    }
    const map = new Map<string, { name: string; served: number; revenue: number; active: number }>();
    for (const order of filtered) {
      const data = order as Record<string, unknown>;
      const waiterUid =
        (typeof data.assignedWaiterUid === "string" && data.assignedWaiterUid) ||
        (data.assignedTo && typeof data.assignedTo === "object" && typeof (data.assignedTo as Record<string, unknown>).waiterId === "string"
          ? ((data.assignedTo as Record<string, unknown>).waiterId as string)
          : "");
      if (!waiterUid) continue;
      const status = (order.canonicalStatus || order.status || "").toString().toLowerCase();
      const row = map.get(waiterUid) ?? {
        name: waiterNameByUid.get(waiterUid) ?? waiterUid.slice(0, 8),
        served: 0,
        revenue: 0,
        active: 0
      };
      if (["completed", "delivered"].includes(status)) {
        row.served += 1;
        row.revenue += Number(order.totalAmount ?? 0);
      } else if (["new", "accepted", "preparing", "ready"].includes(status)) {
        row.active += 1;
      }
      map.set(waiterUid, row);
    }
    return [...map.values()].sort((a, b) => b.served - a.served).slice(0, 8);
  }, [filtered, staff]);

  function exportExcel() {
    const lines: string[] = [];
    lines.push(`Period,${period}`);
    lines.push(`Sales,${metrics.sales}`);
    lines.push(`Revenue,${metrics.revenue.toFixed(2)}`);
    lines.push(`Discounts,${metrics.discounts.toFixed(2)}`);
    lines.push(`Refunds,${metrics.refunds.toFixed(2)}`);
    lines.push(`GST,${metrics.gst.toFixed(2)}`);
    lines.push(`AOV,${metrics.aov.toFixed(2)}`);
    lines.push("");
    lines.push("Best Selling Item,Qty,Revenue");
    for (const item of bestSellingItems) {
      lines.push(`${item.name},${item.qty},${item.revenue.toFixed(2)}`);
    }
    lines.push("");
    lines.push("Category,Sales");
    for (const row of categorySales) {
      lines.push(`${row.label},${row.value.toFixed(2)}`);
    }
    downloadFile(`manager-reports-${period}.csv`, lines.join("\n"), "text/csv;charset=utf-8;");
  }

  function exportPdf() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Manager Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:8px;font-size:12px;text-align:left}</style></head><body>
      <h1>Manager Report (${period})</h1>
      <p>Sales: ${metrics.sales} | Revenue: ${metrics.revenue.toFixed(2)} | Discounts: ${metrics.discounts.toFixed(2)} | Refunds: ${metrics.refunds.toFixed(2)} | GST: ${metrics.gst.toFixed(2)} | AOV: ${metrics.aov.toFixed(2)}</p>
      <h3>Best Selling Items</h3>
      <table><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr>
      ${bestSellingItems.map((x) => `<tr><td>${x.name}</td><td>${x.qty}</td><td>${x.revenue.toFixed(2)}</td></tr>`).join("")}
      </table>
      <h3>Category Sales</h3>
      <table><tr><th>Category</th><th>Sales</th></tr>
      ${categorySales.map((x) => `<tr><td>${x.label}</td><td>${x.value.toFixed(2)}</td></tr>`).join("")}
      </table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Reports</h3>
            <p className="text-xs text-theme-text-secondary">Sales, revenue, performance and trend analytics</p>
          </div>
          <div className="flex items-center gap-2">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  period === p
                    ? "bg-theme-primary text-white"
                    : "border border-theme-border bg-theme-card text-theme-text-secondary hover:bg-theme-hover"
                }`}
              >
                {p}
              </button>
            ))}
            <button type="button" onClick={exportPdf} className="rounded-lg border border-theme-border bg-theme-card px-3 py-1.5 text-xs font-semibold text-theme-text-secondary hover:bg-theme-hover">
              Export PDF
            </button>
            <button type="button" onClick={exportExcel} className="rounded-lg border border-theme-border bg-theme-card px-3 py-1.5 text-xs font-semibold text-theme-text-secondary hover:bg-theme-hover">
              Export Excel
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-theme-text-secondary">
          Last update:{" "}
          <span className="font-semibold text-theme-text-primary">
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
        </p>
      </header>

      <div className="space-y-4 p-4 md:p-5">
        {loading ? (
          <p className="text-sm text-theme-text-secondary">Loading reports…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">Sales</p><p className="mt-1 text-xl font-bold">{metrics.sales}</p></article>
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">Revenue</p><p className="mt-1 text-xl font-bold">{money(metrics.revenue)}</p></article>
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">Discounts</p><p className="mt-1 text-xl font-bold">{money(metrics.discounts)}</p></article>
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">Refunds</p><p className="mt-1 text-xl font-bold">{money(metrics.refunds)}</p></article>
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">GST</p><p className="mt-1 text-xl font-bold">{money(metrics.gst)}</p></article>
              <article className="rounded-xl border border-theme-border bg-theme-card p-3"><p className="text-xs text-theme-text-secondary">Average Order Value</p><p className="mt-1 text-xl font-bold">{money(metrics.aov)}</p></article>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BarChart
                title="Best Selling Items"
                rows={bestSellingItems.map((x) => ({ label: x.name, value: x.qty }))}
              />
              <BarChart title="Category Sales" rows={categorySales} />
              <BarChart title="Peak Hours" rows={peakHours} />
              <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="mb-2 text-sm font-semibold text-theme-text-primary">Kitchen Performance</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-theme-surface p-2">
                    <p className="text-xs text-theme-text-secondary">Average Prep Time</p>
                    <p className="mt-1 font-semibold text-theme-text-primary">{kitchenPerformance.avgPrep.toFixed(1)} min</p>
                  </div>
                  <div className="rounded-lg bg-theme-surface p-2">
                    <p className="text-xs text-theme-text-secondary">On-time Rate</p>
                    <p className="mt-1 font-semibold text-theme-text-primary">{kitchenPerformance.onTimeRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-theme-surface p-2">
                    <p className="text-xs text-theme-text-secondary">Delayed Orders</p>
                    <p className="mt-1 font-semibold text-theme-text-primary">{kitchenPerformance.delayed}</p>
                  </div>
                  <div className="rounded-lg bg-theme-surface p-2">
                    <p className="text-xs text-theme-text-secondary">Measured Orders</p>
                    <p className="mt-1 font-semibold text-theme-text-primary">{kitchenPerformance.measured}</p>
                  </div>
                </div>
              </article>
            </div>

            <article className="rounded-xl border border-theme-border bg-theme-card p-3">
              <p className="mb-2 text-sm font-semibold text-theme-text-primary">Waiter Performance</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-theme-text-secondary">
                    <tr>
                      <th className="px-2 py-2">Waiter</th>
                      <th className="px-2 py-2">Served Orders</th>
                      <th className="px-2 py-2">Active Orders</th>
                      <th className="px-2 py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waiterPerformance.length === 0 ? (
                      <tr>
                        <td className="px-2 py-3 text-theme-text-secondary" colSpan={4}>
                          No waiter-linked performance data in selected period.
                        </td>
                      </tr>
                    ) : (
                      waiterPerformance.map((row) => (
                        <tr key={row.name} className="border-t border-theme-border">
                          <td className="px-2 py-2">{row.name}</td>
                          <td className="px-2 py-2">{row.served}</td>
                          <td className="px-2 py-2">{row.active}</td>
                          <td className="px-2 py-2 text-right font-semibold">{money(row.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </div>
    </section>
  );
}
