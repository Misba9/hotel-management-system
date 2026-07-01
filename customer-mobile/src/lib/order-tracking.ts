import { Timestamp } from "firebase/firestore";

export const ORDER_TRACKING_STEPS = [
  { key: "pending", label: "Order placed", description: "We've received your order" },
  { key: "accepted", label: "Accepted", description: "Restaurant confirmed your order" },
  { key: "preparing", label: "Preparing", description: "Your items are being prepared" },
  { key: "out_for_delivery", label: "Out for delivery", description: "On the way to you" },
  { key: "delivered", label: "Delivered", description: "Enjoy your order" }
] as const;

export function statusToTimelineIndex(status: string): number {
  const s = status.toLowerCase().trim();
  if (s === "cancelled" || s === "canceled") return -1;
  if (s === "delivered") return 4;
  if (s === "out_for_delivery" || s === "ready") return 3;
  if (s === "preparing") return 2;
  if (s === "accepted" || s === "confirmed") return 1;
  return 0;
}

export function isCancelledStatus(status: string): boolean {
  const s = status.toLowerCase().trim();
  return s === "cancelled" || s === "canceled";
}

export function firestoreTimeToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}
