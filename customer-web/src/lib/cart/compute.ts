import { DELIVERY_FEE_RUPEES } from "./constants";
import type { CartLine } from "./types";

export function computeSubtotal(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** Total number of units (sum of quantities). */
export function computeLineItemCount(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function computeTotalAfterDiscount(subtotal: number, discount: number): number {
  return Math.max(subtotal - discount, 0);
}

export function computeDeliveryFee(items: CartLine[]): number {
  return items.length > 0 ? DELIVERY_FEE_RUPEES : 0;
}

export function computeGrandTotal(items: CartLine[], discount: number): number {
  const subtotal = computeSubtotal(items);
  const afterDiscount = computeTotalAfterDiscount(subtotal, discount);
  return afterDiscount + computeDeliveryFee(items);
}

export function getLineTotal(item: CartLine): number {
  return item.price * item.quantity;
}

export function getItemQuantity(items: CartLine[], productId: string): number {
  return items.find((item) => item.productId === productId)?.quantity ?? 0;
}
