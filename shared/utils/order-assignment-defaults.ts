/** Default `orders.assignedTo` when an order is created — kitchen is auto-routed; delivery filled when status is `ready` (delivery orders). */
export const DEFAULT_ORDER_ASSIGNED_TO = {
  kitchenId: "auto",
  deliveryId: ""
} as const;
