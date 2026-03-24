import type { OrderStatus } from "@shared/types/domain";

const orderProgression: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered"
];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  const fromIdx = orderProgression.indexOf(from);
  const toIdx = orderProgression.indexOf(to);
  return toIdx >= fromIdx;
}
