import type { StaffOrderRow } from "@/services/orders";
import { isOrderPaid } from "../cashier-order-filters";

export type CustomerInsight = {
  name: string;
  phone: string;
  visits: number;
  totalSpend: number;
  lastOrderAt: Date | null;
  rewardPoints: number;
  isVip: boolean;
};

function orderPhone(order: StaffOrderRow): string {
  const raw = order as StaffOrderRow & { phone?: string; customerName?: string };
  const fromCustomer = order.customer?.phone ?? "";
  const direct = typeof raw.phone === "string" ? raw.phone : "";
  return (direct || fromCustomer).trim();
}

function orderName(order: StaffOrderRow): string {
  const raw = order as StaffOrderRow & { customerName?: string };
  return (raw.customerName ?? order.customer?.name ?? "").trim();
}

export function buildCustomerInsights(orders: StaffOrderRow[]): CustomerInsight[] {
  const map = new Map<string, CustomerInsight>();

  for (const order of orders) {
    const phone = orderPhone(order);
    const name = orderName(order) || "Walk-in";
    const key = phone || name.toLowerCase();
    if (!key) continue;

    const cur = map.get(key) ?? {
      name,
      phone,
      visits: 0,
      totalSpend: 0,
      lastOrderAt: null,
      rewardPoints: 0,
      isVip: false
    };

    cur.visits += 1;
    if (isOrderPaid(order.paymentStatus)) cur.totalSpend += order.totalAmount ?? 0;

    const created = order.createdAt as { toDate?: () => Date } | null;
    const at = created && typeof created.toDate === "function" ? created.toDate() : null;
    if (at && (!cur.lastOrderAt || at > cur.lastOrderAt)) cur.lastOrderAt = at;

    cur.rewardPoints = Math.floor(cur.totalSpend / 100);
    cur.isVip = cur.visits >= 5 || cur.totalSpend >= 5000;
    map.set(key, cur);
  }

  return [...map.values()].sort((a, b) => b.totalSpend - a.totalSpend);
}

export function findCustomerByPhone(orders: StaffOrderRow[], phone: string): CustomerInsight | null {
  const q = phone.trim();
  if (!q) return null;
  return buildCustomerInsights(orders).find((c) => c.phone.includes(q) || q.includes(c.phone)) ?? null;
}
