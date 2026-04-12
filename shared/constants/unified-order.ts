/** Single `orders/{orderId}` model used by POS, kitchen, delivery, admin, and customer. */
export const UNIFIED_ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered"
] as const;

export type UnifiedOrderStatus = (typeof UNIFIED_ORDER_STATUSES)[number];
