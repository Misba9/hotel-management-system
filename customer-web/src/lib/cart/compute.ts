import type { CartLine } from "./types";

export function computeSubtotal(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/** Total number of units (sum of quantities). */
export function computeLineItemCount(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function computeTotalAfterDiscount(subtotal: number, discount: number): number {
  return Math.max(subtotal - discount, 0);
}

export function getLineTotal(item: CartLine): number {
  return item.price * item.qty;
}

export function getItemQuantity(items: CartLine[], productId: string): number {
  return items.find((item) => item.id === productId)?.qty ?? 0;
}
