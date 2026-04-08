import { Timestamp } from "firebase/firestore";

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
 * Human-readable ETA: prefers live rider ETA, then optional server field, then simple heuristics.
 */
export function formatEstimatedDelivery(args: {
  status: string;
  createdAtIso: string;
  etaMinutesFromRider?: number | null;
  estimatedDeliveryAtIso?: string | null;
}): string {
  const { status, createdAtIso, etaMinutesFromRider, estimatedDeliveryAtIso } = args;
  if (isCancelledStatus(status)) return "—";

  if (typeof etaMinutesFromRider === "number" && etaMinutesFromRider > 0) {
    return `About ${etaMinutesFromRider} min`;
  }

  if (estimatedDeliveryAtIso) {
    const t = new Date(estimatedDeliveryAtIso);
    if (!Number.isNaN(t.getTime())) {
      return `By ${t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  const s = status.toLowerCase();
  if (s === "delivered") return "Completed";

  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return "Typically 30–45 min";

  const addMins = (m: number) =>
    new Date(created.getTime() + m * 60_000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });

  if (s === "out_for_delivery" || s === "ready") return `Often arrives by ${addMins(25)}`;
  if (s === "preparing" || s === "accepted" || s === "confirmed") return `Often arrives by ${addMins(35)}`;
  return `Usually ready in 30–45 min`;
}
