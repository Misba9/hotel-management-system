/**
 * Waiter POS / dine-in tickets: `orders` docs created by `confirmRestaurantOrder`
 * (tokenNumber set, no SaaS `orderType` pipeline fields).
 */
export function isWaiterPosDineInOrder(order: {
  orderType?: string;
  tokenNumber?: number;
}): boolean {
  const ot = String(order.orderType ?? "").toLowerCase().trim();
  if (ot === "dine_in" || ot === "table") return true;
  if (ot && ot !== "dine-in") return false;
  return typeof order.tokenNumber === "number" && Number.isFinite(order.tokenNumber);
}
