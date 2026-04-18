import type { Timestamp } from "firebase/firestore";

/** Collection path: `tables` */
export const RESTAURANT_TABLES_COLLECTION = "tables" as const;

/** Collection path: `orders` (table-service tickets use {@link TableServiceOrderDoc}). */
export const RESTAURANT_ORDERS_COLLECTION = "orders" as const;

export type RestaurantTableStatus = "FREE" | "OCCUPIED";

/**
 * Canonical floor table document: `tables/{id}` (`id` is the document id; also mirror as field if you prefer).
 * Extra fields (branchId, name, …) are allowed for your product; these are the core waiter/floor fields.
 */
export interface RestaurantTableDoc {
  /** Same as document id when you store it as a field (optional convenience). */
  id?: string;
  tableNumber: number;
  status: RestaurantTableStatus;
  /** Active table ticket, if you track it on the table row. */
  currentOrderId?: string | null;
}

/** Line item shape for normalized table orders (see {@link normalizeOrderDocToFloorShape}). */
export interface RestaurantOrderItemLine {
  name: string;
  price: number;
  qty: number;
}

export type TableServiceOrderStatus = "PLACED" | "PREPARING" | "READY" | "SERVED";

/**
 * Canonical **table-service** order view (subset of full `orders/{id}` docs).
 * Production documents may also include `orderType`, `paymentStatus`, `userId`, `totalAmount`, `items[].quantity`, etc.;
 * use {@link normalizeOrderDocToFloorShape} to map Firestore → this shape.
 */
export interface TableServiceOrderDoc {
  id: string;
  tableId: string;
  status: TableServiceOrderStatus | string;
  items: RestaurantOrderItemLine[];
  total: number;
  createdAt: Timestamp | null;
}
