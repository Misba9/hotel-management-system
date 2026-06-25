/**
 * Canonical table model for `tables/{tableId}` and table fields on orders.
 */

export const TABLE_STATUSES = ["free", "occupied"] as const;

export type TableStatus = (typeof TABLE_STATUSES)[number];

/** Firestore `tables/{tableId}` document. */
export interface TableDoc {
  id: string;
  tableNumber: number;
  name: string;
  status: TableStatus | string;
  currentOrderId?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Table context embedded on `orders/{orderId}`. */
export interface OrderTableFields {
  tableId?: string;
  tableNumber?: number;
  tableName?: string;
}

/** Dine-in order types stored in `orderType`. */
export const DINE_IN_ORDER_TYPES = ["dine_in", "table", "dine-in"] as const;

export type DineInOrderType = (typeof DINE_IN_ORDER_TYPES)[number];
