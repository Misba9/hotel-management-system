/**
 * Canonical `invoices/{invoiceId}` shape — document id matches `orderId` (1:1 with order).
 */
export type InvoiceLineItem = {
  id?: string;
  name: string;
  price: number;
  qty: number;
};

export type InvoiceDoc = {
  orderId: string;
  invoiceId: string;
  userId: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: unknown;
  /** Set by server-side writers (Admin SDK / Cloud Functions). */
  source?: "storefront" | "pos" | "dine_in" | "callable_v1" | "legacy_placeOrder";
};
