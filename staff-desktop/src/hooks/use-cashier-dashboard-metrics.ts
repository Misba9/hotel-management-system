import { useMemo } from "react";
import type { CashierDashboardMetrics } from "@/components/pos/pos-types";
import type { StaffOrderRow } from "@/services/orders";
import { isOrderPaid, isOrderPendingPayment } from "@/lib/cashier-order-filters";
import { resolveKitchenStage } from "@/lib/pos/kitchen-stages";
import { resolveOrderSource } from "@/lib/pos/order-source";

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function orderCreatedAt(order: StaffOrderRow): Date | null {
  const v = order.createdAt;
  if (!v || typeof v !== "object") return null;
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return null;
  try {
    return maybe.toDate();
  } catch {
    return null;
  }
}

export function useCashierDashboardMetrics(
  orders: StaffOrderRow[],
  activeTables = 0
): CashierDashboardMetrics {
  return useMemo(() => {
    const metrics: CashierDashboardMetrics = {
      todaySales: 0,
      todayOrders: 0,
      dineInCount: 0,
      parcelCount: 0,
      swiggyCount: 0,
      zomatoCount: 0,
      onlineCount: 0,
      pendingCount: 0,
      kitchenCount: 0,
      deliveryCount: 0,
      activeTables: 0,
      pendingBills: 0,
      cashDrawer: 0,
      upiTotal: 0,
      cardTotal: 0,
      averageBill: 0
    };

    let paidCount = 0;

    for (const order of orders) {
      const created = orderCreatedAt(order);
      if (!created || !isToday(created)) continue;

      metrics.todayOrders += 1;
      const src = resolveOrderSource(order);
      if (src === "dine_in") metrics.dineInCount += 1;
      else if (src === "parcel") metrics.parcelCount += 1;
      else if (src === "swiggy") metrics.swiggyCount += 1;
      else if (src === "zomato") metrics.zomatoCount += 1;
      else metrics.onlineCount += 1;

      if (src === "swiggy" || src === "zomato" || src === "website" || src === "qr" || src === "phone" || src === "online") {
        metrics.deliveryCount += 1;
      }

      if (isOrderPendingPayment(order.paymentStatus)) {
        metrics.pendingCount += 1;
        if (order.canonicalStatus === "ready" || order.canonicalStatus === "served") {
          metrics.pendingBills += 1;
        }
      }

      const stage = resolveKitchenStage(order);
      if (stage === "preparing" || stage === "accepted" || stage === "received") metrics.kitchenCount += 1;

      if (isOrderPaid(order.paymentStatus)) {
        const amt = order.totalAmount ?? 0;
        metrics.todaySales += amt;
        paidCount += 1;
        const method = String((order as StaffOrderRow & { paymentMethod?: string }).paymentMethod ?? "").toLowerCase();
        if (method === "cash" || method === "") metrics.cashDrawer += amt;
        else if (method === "upi" || method === "qr" || method === "wallet") metrics.upiTotal += amt;
        else if (method === "card") metrics.cardTotal += amt;
      }
    }

    metrics.todaySales = Math.round(metrics.todaySales * 100) / 100;
    metrics.cashDrawer = Math.round(metrics.cashDrawer * 100) / 100;
    metrics.upiTotal = Math.round(metrics.upiTotal * 100) / 100;
    metrics.cardTotal = Math.round(metrics.cardTotal * 100) / 100;
    metrics.averageBill = paidCount > 0 ? Math.round((metrics.todaySales / paidCount) * 100) / 100 : 0;
    metrics.activeTables = activeTables;
    return metrics;
  }, [orders, activeTables]);
}
