import type { StaffOrderRow } from "@/services/orders";
import { filterCashierOrders } from "../cashier-order-filters";
import { resolveOrderSource } from "./order-source";

export type ParcelDateFilter = "today" | "yesterday" | "week" | "all";

function orderDate(order: StaffOrderRow): Date | null {
  const raw = order.createdAt;
  if (!raw || typeof raw !== "object") return null;
  const maybe = raw as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return null;
  return maybe.toDate();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

export function isParcelOrder(order: StaffOrderRow): boolean {
  return resolveOrderSource(order) === "parcel";
}

export function getParcelOrders(orders: StaffOrderRow[]): StaffOrderRow[] {
  return orders.filter(isParcelOrder);
}

export function countTodayParcelOrders(orders: StaffOrderRow[]): number {
  const todayStart = startOfDay(new Date());
  return getParcelOrders(orders).filter((o) => {
    const d = orderDate(o);
    return d !== null && d >= todayStart;
  }).length;
}

export function filterParcelOrdersByDate(
  orders: StaffOrderRow[],
  filter: ParcelDateFilter
): StaffOrderRow[] {
  const parcel = getParcelOrders(orders);
  if (filter === "all") return parcel;

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = startOfWeek(now);

  return parcel.filter((o) => {
    const d = orderDate(o);
    if (!d) return false;
    if (filter === "today") return d >= todayStart;
    if (filter === "yesterday") return d >= yesterdayStart && d < todayStart;
    if (filter === "week") return d >= weekStart;
    return true;
  });
}

export function searchParcelOrders(
  orders: StaffOrderRow[],
  query: string,
  dateFilter: ParcelDateFilter
): StaffOrderRow[] {
  const dated = filterParcelOrdersByDate(orders, dateFilter);
  const sorted = [...dated].sort((a, b) => {
    const da = orderDate(a)?.getTime() ?? 0;
    const db = orderDate(b)?.getTime() ?? 0;
    return db - da;
  });
  if (!query.trim()) return sorted;
  return filterCashierOrders(sorted, { search: query, source: "all", status: "all" });
}

export function orderCardAccent(order: StaffOrderRow): "hold" | "paid" | "preparing" | "cancelled" {
  const status = String(order.status ?? "").toLowerCase();
  const canonical = String(order.canonicalStatus ?? "").toLowerCase();
  if (status === "cancelled" || status === "rejected" || status === "void") return "cancelled";
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  if (ps === "paid") return "paid";
  if (canonical === "preparing" || canonical === "ready" || status === "preparing") return "preparing";
  return "hold";
}

export function formatParcelTime(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
