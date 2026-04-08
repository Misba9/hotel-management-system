export const ORDER_SUCCESS_STORAGE_KEY = "order_success_snapshot";

export type OrderSuccessSnapshot = {
  orderId: string;
  totalAmount: number;
  /** Signed token for guest live tracking via `/api/tracking/[orderId]?t=…`. */
  trackingToken?: string;
  message?: string;
  placedAt: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
    lineTotal: number;
  }>;
};
