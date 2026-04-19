import { Timestamp } from "firebase/firestore";
import { formatSmartEstimatedDelivery, type TrackingEtaInput } from "@/lib/delivery-eta";

/** Customer-facing timeline (maps various backend statuses into 5 steps). */
export const ORDER_TRACKING_STEPS = [
  { key: "pending", label: "Order placed", description: "We’ve received your order" },
  { key: "accepted", label: "Accepted", description: "Restaurant confirmed your order" },
  { key: "preparing", label: "Preparing", description: "Your items are being prepared" },
  { key: "out_for_delivery", label: "Out for delivery", description: "On the way to you" },
  { key: "delivered", label: "Delivered", description: "Enjoy your order" }
] as const;

export const ORDER_TRACKING_STEP_COUNT = ORDER_TRACKING_STEPS.length;

/** Map Firestore/API status string to completed step index (0..4). */
export function statusToTimelineIndex(status: string): number {
  const s = status.toLowerCase().trim();
  if (s === "cancelled" || s === "canceled") return -1;
  if (s === "delivered") return 4;
  if (s === "out_for_delivery") return 3;
  if (s === "ready") return 3;
  if (s === "preparing") return 2;
  if (s === "accepted" || s === "confirmed") return 1;
  if (s === "pending" || s === "created") return 0;
  return 0;
}

/** Index of the step that should show as “current” (pulsing). -1 = cancelled/unknown. */
export function statusToCurrentStepIndex(status: string): number {
  const idx = statusToTimelineIndex(status);
  if (idx < 0) return -1;
  return idx;
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
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

/**
 * Human-readable ETA: rider/server first, then smart model (distance · prep · traffic · kitchen phase).
 * Pass `distanceKm` / line counts when available for tighter ranges (e.g. tracking page).
 */
export function formatEstimatedDelivery(args: {
  status: string;
  createdAtIso: string;
  etaMinutesFromRider?: number | null;
  estimatedDeliveryAtIso?: string | null;
  distanceKm?: number | null;
  lineCount?: number;
  totalQuantity?: number;
}): string {
  if (isCancelledStatus(args.status)) return "—";
  const payload: TrackingEtaInput = {
    status: args.status,
    createdAtIso: args.createdAtIso,
    etaMinutesFromRider: args.etaMinutesFromRider,
    estimatedDeliveryAtIso: args.estimatedDeliveryAtIso,
    distanceKm: args.distanceKm,
    lineCount: args.lineCount,
    totalQuantity: args.totalQuantity
  };
  return formatSmartEstimatedDelivery(payload);
}
