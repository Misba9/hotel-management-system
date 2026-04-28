/**
 * Waiter POS / dine-in tickets: `orders` docs created by `confirmRestaurantOrder`
 * (tokenNumber set, no SaaS `orderType` pipeline fields).
 */
export function isWaiterPosDineInOrder(order: {
  orderType?: string;
  tokenNumber?: number;
}): boolean {
  if (order.orderType) return false;
  return typeof order.tokenNumber === "number" && Number.isFinite(order.tokenNumber);
}
