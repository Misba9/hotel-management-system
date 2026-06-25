/**
 * Canonical customer fields on orders and customer directory collections.
 */

/** Top-level customer fields on `orders/{orderId}` — preferred over nested `customer`. */
export interface OrderCustomerFields {
  customerName?: string;
  customerPhone?: string;
}

/** Legacy nested customer object (still read for backward compatibility). */
export interface NestedCustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
}

/** `customers/{uid}` directory document (admin / storefront sync). */
export interface CustomerDoc {
  uid?: string;
  name: string;
  phone?: string;
  email?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
  totalOrders?: number;
}
