import { getDistanceKm } from "@/lib/geo-distance";

/** Minutes per km travel (urban average) — aligns with `distance * 5 + prep + traffic`. */
export const MINUTES_PER_KM = 5;

const DEFAULT_DISTANCE_KM_WHEN_UNKNOWN = 3.5;

/** Base kitchen prep (minutes) before volume add-ons. */
const BASE_PREP_MIN = 10;

/**
 * Rush windows (local time, simplified): lunch & dinner see more traffic delay.
 */
export function trafficFactorMinutes(date: Date = new Date()): number {
  const h = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;

  let extra = 0;
  if (h >= 12 && h < 14) extra += 8;
  else if (h >= 19 && h < 22) extra += 10;
  else if (h >= 8 && h < 11) extra += 3;

  if (isWeekend && h >= 11 && h < 21) extra += 4;
  return extra;
}

/**
 * Prep scales slightly with distinct lines and total units (order volume).
 */
export function prepTimeMinutes(lineCount: number, totalQuantity: number): number {
  const lines = Math.max(0, lineCount);
  const qty = Math.max(0, totalQuantity);
  const volumeBump = Math.min(12, lines * 2 + Math.max(0, qty - lines) * 0.75);
  return BASE_PREP_MIN + volumeBump;
}

/** Extra delay while order is still in or before kitchen (queue / prep backlog). */
export function kitchenPhaseExtraMinutes(status: string): number {
  const s = status.toLowerCase().trim().replace(/\s+/g, "_");
  if (s === "pending" || s === "created" || s === "confirmed") return 8;
  if (s === "accepted") return 5;
  if (s === "preparing") return 2;
  if (s === "ready") return 0;
  if (s === "out_for_delivery" || s === "picked_up") return 0;
  return 0;
}

/**
 * Core heuristic: `distance * MINUTES_PER_KM + prep + traffic` (+ kitchen phase when tracking).
 */
export function estimateDeliveryMinutes(input: {
  distanceKm: number;
  lineCount: number;
  totalQuantity: number;
  /** When tracking an existing order */
  orderStatus?: string;
  now?: Date;
}): { center: number; min: number; max: number } {
  const now = input.now ?? new Date();
  const travel = Math.max(4, input.distanceKm * MINUTES_PER_KM);
  const prep = prepTimeMinutes(input.lineCount, input.totalQuantity);
  const traffic = trafficFactorMinutes(now);
  const kitchen = input.orderStatus ? kitchenPhaseExtraMinutes(input.orderStatus) : 0;

  const center = Math.round(travel + prep + traffic + kitchen);
  const spread = Math.max(3, Math.round(2 + input.distanceKm * 0.5));
  const min = Math.max(12, center - spread);
  const max = center + spread;
  return { center, min, max };
}

export function formatEtaRange(min: number, max: number): string {
  const a = Math.round(min);
  const b = Math.round(max);
  if (a === b) return `${a} min`;
  return `${a}–${b} min`;
}

/** User-facing phrase for checkout / banners. */
export function formatDeliveryWindowPhrase(min: number, max: number): string {
  return `Delivery in ${formatEtaRange(min, max)}`;
}

export function computeDistanceKm(
  restaurant: { lat: number; lng: number },
  delivery: { lat: number; lng: number } | null | undefined
): number | null {
  if (!delivery || !Number.isFinite(delivery.lat) || !Number.isFinite(delivery.lng)) return null;
  return Math.round(getDistanceKm(restaurant, delivery) * 100) / 100;
}

export function estimateCheckoutDisplay(input: {
  restaurant: { lat: number; lng: number };
  deliveryLatLng: { lat: number; lng: number } | null | undefined;
  lineCount: number;
  totalQuantity: number;
  now?: Date;
}): { distanceKm: number | null; phrase: string; min: number; max: number } {
  const dKm = computeDistanceKm(input.restaurant, input.deliveryLatLng);
  const distanceKm = dKm ?? DEFAULT_DISTANCE_KM_WHEN_UNKNOWN;
  const { min, max } = estimateDeliveryMinutes({
    distanceKm,
    lineCount: input.lineCount,
    totalQuantity: input.totalQuantity,
    now: input.now
  });
  return {
    distanceKm: dKm,
    phrase: formatDeliveryWindowPhrase(min, max),
    min,
    max
  };
}

export type TrackingEtaInput = {
  status: string;
  createdAtIso: string;
  etaMinutesFromRider?: number | null;
  estimatedDeliveryAtIso?: string | null;
  /** Restaurant ↔ customer drop — when known, refines fallback before rider ETA. */
  distanceKm?: number | null;
  /** For prep/kitchen heuristics if you pass line counts from order (optional). */
  lineCount?: number;
  totalQuantity?: number;
};

/**
 * Rider / server ETA wins; otherwise model from distance + kitchen phase + time-of-day.
 * Returns a single display string for summaries (includes range when model-based).
 */
export function formatSmartEstimatedDelivery(input: TrackingEtaInput): string {
  const status = input.status;
  const s = status.toLowerCase().trim();
  if (s === "cancelled" || s === "canceled") return "—";
  if (s === "delivered" || s === "completed") return "Delivered";

  if (typeof input.etaMinutesFromRider === "number" && input.etaMinutesFromRider > 0) {
    const e = input.etaMinutesFromRider;
    const lo = Math.max(5, Math.round(e - 2));
    const hi = Math.round(e + 3);
    return `About ${formatEtaRange(lo, hi)}`;
  }

  if (input.estimatedDeliveryAtIso) {
    const t = new Date(input.estimatedDeliveryAtIso);
    if (!Number.isNaN(t.getTime())) {
      return `By ${t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  const dist =
    input.distanceKm != null && Number.isFinite(input.distanceKm)
      ? input.distanceKm
      : DEFAULT_DISTANCE_KM_WHEN_UNKNOWN;

  const lines = typeof input.lineCount === "number" ? input.lineCount : 2;
  const qty = typeof input.totalQuantity === "number" ? input.totalQuantity : 3;

  const { min, max } = estimateDeliveryMinutes({
    distanceKm: dist,
    lineCount: lines,
    totalQuantity: qty,
    orderStatus: status,
    now: new Date()
  });

  if (s === "out_for_delivery" || s === "ready") {
    return `Arriving in ${formatEtaRange(min, max)}`;
  }
  if (s === "preparing" || s === "accepted" || s === "confirmed") {
    return `Estimated ${formatEtaRange(min, max)}`;
  }

  return formatDeliveryWindowPhrase(min, max);
}
