import type { InvoiceLineItem, InvoiceDoc } from "../types/invoice";

/**
 * Normalize line items and compute subtotal (sum of line totals, rounded).
 */
export function normalizeInvoiceLines(
  items: Array<{ id?: string; name?: string; price?: number; qty?: number; quantity?: number }>
): { lines: InvoiceLineItem[]; subtotal: number } {
  const lines: InvoiceLineItem[] = items.map((it, idx) => {
    const qty = typeof it.qty === "number" ? it.qty : typeof it.quantity === "number" ? it.quantity : 1;
    const price = typeof it.price === "number" ? it.price : 0;
    const name = typeof it.name === "string" && it.name.trim() ? it.name.trim() : "Item";
    const id = typeof it.id === "string" ? it.id : `line_${idx}`;
    return { id, name, price, qty: qty > 0 ? qty : 1 };
  });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  return { lines, subtotal };
}

export function buildInvoiceDoc(args: {
  orderId: string;
  userId: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: unknown;
  source?: InvoiceDoc["source"];
}): InvoiceDoc {
  return {
    orderId: args.orderId,
    invoiceId: args.orderId,
    userId: args.userId,
    items: args.items,
    subtotal: args.subtotal,
    tax: args.tax,
    total: args.total,
    createdAt: args.createdAt,
    ...(args.source ? { source: args.source } : {})
  };
}
