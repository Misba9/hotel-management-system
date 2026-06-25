/**
 * Canonical order model for the unified `orders/{orderId}` collection.
 * All apps read/write through these types and `shared/utils/canonical-order-fields.ts`.
 */

/** Standard order lifecycle — single source of truth across all apps. */
export const CANONICAL_ORDER_STATUSES = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled"
] as const;

export type CanonicalOrderStatus = (typeof CANONICAL_ORDER_STATUSES)[number];

/** Delivery pipeline extends completed with an intermediate step (normalized to canonical on read). */
export const DELIVERY_ORDER_STATUSES = ["out_for_delivery", "delivered"] as const;

export type DeliveryOrderStatus = (typeof DELIVERY_ORDER_STATUSES)[number];

export const CANONICAL_PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;

export type CanonicalPaymentStatus = (typeof CANONICAL_PAYMENT_STATUSES)[number];

/** Line item embedded in `orders/{orderId}.items[]`. */
export interface OrderLineItem {
  id: string;
  productId?: string;
  name: string;
  qty: number;
  price: number;
  unitPrice?: number;
  note?: string;
  modifications?: string[];
}

/** Canonical fields on every `orders/{orderId}` document. */
export interface OrderDoc {
  id: string;
  status: CanonicalOrderStatus | string;
  paymentStatus?: CanonicalPaymentStatus | string;
  paymentMethod?: string;
  orderType?: string;
  source?: string;
  items: OrderLineItem[];
  total: number;
  totalAmount?: number;
  subtotal?: number;
  tax?: number;
  tableId?: string;
  tableNumber?: number;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  tokenNumber?: number;
  userId?: string;
  createdByUid?: string;
  branchId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  paidAt?: unknown;
  readyAt?: unknown;
  servedAt?: unknown;
  sentToKitchenAt?: unknown;
  kitchenNotified?: boolean;
  printed?: boolean;
  trackingId?: string;
  address?: string;
  invoiceId?: string;
}

/** App-facing order row after Firestore mapping + normalization. */
export interface NormalizedOrder extends OrderDoc {
  canonicalStatus: CanonicalOrderStatus;
  canonicalPaymentStatus: CanonicalPaymentStatus;
}
