import { useMemo, useState } from "react";
import { formatSource } from "@/lib/kds-utils";
import { historyDisplayStatus, type KitchenHistoryOrder } from "@/lib/kitchen-order-mapper";

export type HistoryDateFilter = "today" | "yesterday" | "week" | "month" | "all";
export type HistoryStatusFilter = "all" | "completed" | "cancelled";
export type HistorySourceFilter =
  | "all"
  | "parcel"
  | "dine_in"
  | "swiggy"
  | "zomato"
  | "online";

type KitchenHistoryPanelProps = {
  orders: KitchenHistoryOrder[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inDateRange(iso: string, filter: HistoryDateFilter): boolean {
  if (filter === "all") return true;
  const ts = new Date(iso).getTime();
  const now = new Date();
  const todayStart = startOfDay(now).getTime();

  if (filter === "today") return ts >= todayStart;

  const yesterdayStart = todayStart - 86400000;
  if (filter === "yesterday") return ts >= yesterdayStart && ts < todayStart;

  if (filter === "week") {
    const weekStart = todayStart - 6 * 86400000;
    return ts >= weekStart;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return ts >= monthStart;
}

function matchesSource(order: KitchenHistoryOrder, filter: HistorySourceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "swiggy") return order.source === "swiggy";
  if (filter === "zomato") return order.source === "zomato";
  if (filter === "dine_in") return order.source === "dine-in" || order.orderType === "dine_in" || order.orderType === "table";
  if (filter === "parcel") {
    return order.orderType === "parcel" || order.orderType === "takeaway" || order.source === "takeaway";
  }
  if (filter === "online") {
    const ot = (order.orderType ?? "").toLowerCase();
    return ot === "online" || ot === "website" || ot === "qr" || ot === "phone";
  }
  return true;
}

function matchesSearch(order: KitchenHistoryOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (order.orderId.toLowerCase().includes(q)) return true;
  if (order.orderNumber.toLowerCase().includes(q)) return true;
  if (order.tableNumber?.toLowerCase().includes(q)) return true;
  if (order.customerName?.toLowerCase().includes(q)) return true;
  return false;
}

export function KitchenHistoryPanel({ orders }: KitchenHistoryPanelProps) {
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<HistorySourceFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (!inDateRange(order.completedAt ?? order.createdAt, dateFilter)) return false;
      if (statusFilter === "completed" && order.historyStatus !== "completed") return false;
      if (statusFilter === "cancelled" && order.historyStatus !== "cancelled") return false;
      if (!matchesSource(order, sourceFilter)) return false;
      return matchesSearch(order, search);
    });
  }, [orders, dateFilter, statusFilter, sourceFilter, search]);

  return (
    <div className="kds-history">
      <div className="kds-history-filters">
        <div className="kds-filter-group" role="group" aria-label="Date range">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "This Week"],
              ["month", "This Month"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`kds-filter-chip${dateFilter === id ? " active" : ""}`}
              onClick={() => setDateFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="kds-filter-group" role="group" aria-label="Status">
          {(
            [
              ["all", "All"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`kds-filter-chip${statusFilter === id ? " active" : ""}`}
              onClick={() => setStatusFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="kds-filter-group" role="group" aria-label="Order type">
          {(
            [
              ["all", "All"],
              ["parcel", "Parcel"],
              ["dine_in", "Dine In"],
              ["swiggy", "Swiggy"],
              ["zomato", "Zomato"],
              ["online", "Online"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`kds-filter-chip${sourceFilter === id ? " active" : ""}`}
              onClick={() => setSourceFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="kds-input kds-history-search"
          placeholder="Search order ID, table, customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search history"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="kds-empty">
          <strong>No history orders</strong>
          <span>Try a different date range or filter</span>
        </div>
      ) : (
        <div className="kds-history-list">
          {filtered.map((order) => (
            <article key={order.orderId} className="kds-history-row">
              <div className="kds-history-row-main">
                <div className="kds-order-number">{order.orderNumber}</div>
                <div className="kds-meta-row">
                  <span className="kds-chip source">{formatSource(order.source)}</span>
                  {order.tableNumber ? (
                    <span className="kds-chip table">Table {order.tableNumber}</span>
                  ) : null}
                  <span
                    className={`kds-chip ${
                      order.historyStatus === "cancelled" ? "cancelled" : "completed"
                    }`}
                  >
                    {historyDisplayStatus(order)}
                  </span>
                </div>
                {order.customerName ? (
                  <div className="kds-history-customer">{order.customerName}</div>
                ) : null}
              </div>
              <div className="kds-history-row-side">
                <span className="kds-history-total">₹{order.total.toFixed(0)}</span>
                <span className="kds-history-time">
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  }).format(new Date(order.completedAt ?? order.createdAt))}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
