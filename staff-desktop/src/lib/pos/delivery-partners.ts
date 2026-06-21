import type { StaffOrderRow } from "@/services/orders";
import { resolveOrderSource, type OrderSourceKey } from "@/lib/pos/order-source";

/** Partner integration architecture — UI + filters; sync hooks ready for Cloud Functions. */
export type DeliveryPartnerId = "swiggy" | "zomato" | "website" | "qr" | "phone";

export type PartnerOrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "picked"
  | "delivered"
  | "cancelled";

export const DELIVERY_PARTNERS: {
  id: DeliveryPartnerId;
  name: string;
  color: string;
  logo: string;
  sourceKeys: OrderSourceKey[];
}[] = [
  { id: "swiggy", name: "Swiggy", color: "#F97316", logo: "🟠", sourceKeys: ["swiggy"] },
  { id: "zomato", name: "Zomato", color: "#E23744", logo: "🟡", sourceKeys: ["zomato"] },
  { id: "website", name: "Website", color: "#3B82F6", logo: "🔵", sourceKeys: ["website", "online"] },
  { id: "qr", name: "QR Orders", color: "#8B5CF6", logo: "📱", sourceKeys: ["qr"] },
  { id: "phone", name: "Phone", color: "#06B6D4", logo: "📞", sourceKeys: ["phone"] }
];

export function mapOrderToPartnerStatus(order: StaffOrderRow): PartnerOrderStatus {
  const s = String(order.status ?? "").toLowerCase();
  const canon = String(order.canonicalStatus ?? "").toLowerCase();
  if (s === "cancelled" || s === "rejected") return "cancelled";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s === "picked" || s === "out_for_delivery") return "picked";
  if (canon === "ready" || s === "ready") return "ready";
  if (canon === "preparing" || s === "preparing" || s === "placed") return "preparing";
  if (s === "accepted" || s === "confirmed") return "accepted";
  return "pending";
}

export function filterOrdersByPartner(orders: StaffOrderRow[], partnerId: DeliveryPartnerId): StaffOrderRow[] {
  const partner = DELIVERY_PARTNERS.find((p) => p.id === partnerId);
  if (!partner) return [];
  return orders.filter((o) => partner.sourceKeys.includes(resolveOrderSource(o)));
}

/**
 * Integration surface for future webhooks (Swiggy/Zomato).
 * Cashier UI calls these stubs; wire to Cloud Functions when backend is ready.
 */
export const partnerIntegration = {
  acceptOrder: async (orderId: string, partner: DeliveryPartnerId) => {
    console.info(`[partner:${partner}] accept`, orderId);
    return { ok: true, orderId };
  },
  rejectOrder: async (orderId: string, partner: DeliveryPartnerId, reason?: string) => {
    console.info(`[partner:${partner}] reject`, orderId, reason);
    return { ok: true, orderId };
  },
  updatePrepTime: async (orderId: string, minutes: number) => {
    console.info("[partner] prep time", orderId, minutes);
    return { ok: true };
  },
  markReady: async (orderId: string) => {
    console.info("[partner] ready", orderId);
    return { ok: true };
  },
  printKitchenTicket: async (orderId: string) => {
    console.info("[partner] auto KOT", orderId);
    return { ok: true };
  }
};
