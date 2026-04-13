/**
 * Central restaurant (table / dine-in) order and payment status model.
 * Single forward path per dimension (no skips, no backward).
 *
 * Order: waiter creates → PLACED; kitchen accepts → PREPARING; kitchen done → READY;
 *        waiter serves → SERVED; cashier completes payment → COMPLETED.
 * Payment: PENDING → REQUESTED → PAID
 *
 * Delivery / online orders use `order-status-lifecycle.ts` instead.
 */

export const RestaurantOrderStatus = {
  PLACED: "PLACED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  COMPLETED: "COMPLETED"
} as const;

export type RestaurantOrderStatus =
  (typeof RestaurantOrderStatus)[keyof typeof RestaurantOrderStatus];

export const RESTAURANT_ORDER_STATUS_SEQUENCE = [
  RestaurantOrderStatus.PLACED,
  RestaurantOrderStatus.PREPARING,
  RestaurantOrderStatus.READY,
  RestaurantOrderStatus.SERVED,
  RestaurantOrderStatus.COMPLETED
] as const satisfies readonly RestaurantOrderStatus[];

export const RestaurantPaymentStatus = {
  PENDING: "PENDING",
  REQUESTED: "REQUESTED",
  PAID: "PAID"
} as const;

export type RestaurantPaymentStatus =
  (typeof RestaurantPaymentStatus)[keyof typeof RestaurantPaymentStatus];

export const RESTAURANT_PAYMENT_STATUS_SEQUENCE = [
  RestaurantPaymentStatus.PENDING,
  RestaurantPaymentStatus.REQUESTED,
  RestaurantPaymentStatus.PAID
] as const satisfies readonly RestaurantPaymentStatus[];

const ORDER_BLOCKED = new Set(["cancelled", "canceled", "rejected", "refunded"]);

/** Legacy / alternate labels stored in Firestore → canonical {@link RestaurantOrderStatus}. */
const ORDER_ALIASES: Record<string, RestaurantOrderStatus> = {
  pending: RestaurantOrderStatus.PLACED,
  created: RestaurantOrderStatus.PLACED,
  confirmed: RestaurantOrderStatus.PLACED,
  placed: RestaurantOrderStatus.PLACED,
  accepted: RestaurantOrderStatus.PREPARING,
  preparing: RestaurantOrderStatus.PREPARING,
  ready: RestaurantOrderStatus.READY,
  served: RestaurantOrderStatus.SERVED,
  completed: RestaurantOrderStatus.COMPLETED
};

const PAYMENT_ALIASES: Record<string, RestaurantPaymentStatus> = {
  pending: RestaurantPaymentStatus.PENDING,
  requested: RestaurantPaymentStatus.REQUESTED,
  paid: RestaurantPaymentStatus.PAID
};

function inSequence<T extends string>(seq: readonly T[], value: T): boolean {
  return (seq as readonly string[]).includes(value);
}

export function isRestaurantOrderStatus(value: unknown): value is RestaurantOrderStatus {
  return typeof value === "string" && inSequence(RESTAURANT_ORDER_STATUS_SEQUENCE, value as RestaurantOrderStatus);
}

/**
 * Parse an incoming status string for validation (unknown labels return null, not PLACED).
 * Cancelled / rejected return `"terminal"`.
 */
export function tryParseRestaurantOrderStatus(raw: string): RestaurantOrderStatus | "terminal" | null {
  const s = String(raw ?? "").trim();
  const lower = s.toLowerCase();
  if (ORDER_BLOCKED.has(lower)) return "terminal";
  if (isRestaurantOrderStatus(s)) return s;
  const mapped = ORDER_ALIASES[lower];
  if (mapped) return mapped;
  return null;
}

export function isRestaurantPaymentStatus(value: unknown): value is RestaurantPaymentStatus {
  return typeof value === "string" && inSequence(RESTAURANT_PAYMENT_STATUS_SEQUENCE, value as RestaurantPaymentStatus);
}

/**
 * Map raw `status` to a canonical lifecycle value for transition checks.
 * Unknown strings default to PLACED so legacy rows can advance one step.
 */
export function normalizeRestaurantOrderStatusForTransition(
  raw: string | undefined
): RestaurantOrderStatus | "blocked" {
  const s = String(raw ?? RestaurantOrderStatus.PLACED).trim();
  const lower = s.toLowerCase();
  if (ORDER_BLOCKED.has(lower)) return "blocked";
  if (isRestaurantOrderStatus(s)) return s;
  const mapped = ORDER_ALIASES[lower];
  if (mapped) return mapped;
  return RestaurantOrderStatus.PLACED;
}

export function normalizeRestaurantPaymentStatusForTransition(
  raw: string | undefined
): RestaurantPaymentStatus {
  const s = String(raw ?? RestaurantPaymentStatus.PENDING).trim();
  if (isRestaurantPaymentStatus(s)) return s;
  const lower = s.toLowerCase();
  return PAYMENT_ALIASES[lower] ?? RestaurantPaymentStatus.PENDING;
}

export function canTransitionRestaurantOrder(
  rawFrom: string | undefined,
  to: RestaurantOrderStatus
): boolean {
  const from = normalizeRestaurantOrderStatusForTransition(rawFrom);
  if (from === "blocked") return false;
  const i = RESTAURANT_ORDER_STATUS_SEQUENCE.indexOf(from);
  const j = RESTAURANT_ORDER_STATUS_SEQUENCE.indexOf(to);
  if (i < 0 || j < 0) return false;
  return j === i + 1;
}

export function assertValidRestaurantOrderTransition(
  rawFrom: string | undefined,
  to: RestaurantOrderStatus
): void {
  if (!canTransitionRestaurantOrder(rawFrom, to)) {
    const from = normalizeRestaurantOrderStatusForTransition(rawFrom);
    throw new Error(
      `Invalid restaurant order status transition: "${rawFrom ?? ""}" → "${to}". ` +
        `(normalized from: ${from === "blocked" ? "blocked/terminal" : from}; expected exactly one step forward in RESTAURANT_ORDER_STATUS_SEQUENCE)`
    );
  }
}

export function getAllowedNextRestaurantOrderStatuses(
  from: RestaurantOrderStatus | null
): RestaurantOrderStatus[] {
  if (from == null) return [];
  const i = RESTAURANT_ORDER_STATUS_SEQUENCE.indexOf(from);
  if (i < 0 || i >= RESTAURANT_ORDER_STATUS_SEQUENCE.length - 1) return [];
  return [RESTAURANT_ORDER_STATUS_SEQUENCE[i + 1]];
}

export function canTransitionRestaurantPayment(
  rawFrom: string | undefined,
  to: RestaurantPaymentStatus
): boolean {
  const from = normalizeRestaurantPaymentStatusForTransition(rawFrom);
  const i = RESTAURANT_PAYMENT_STATUS_SEQUENCE.indexOf(from);
  const j = RESTAURANT_PAYMENT_STATUS_SEQUENCE.indexOf(to);
  if (i < 0 || j < 0) return false;
  return j === i + 1;
}

export function assertValidRestaurantPaymentTransition(
  rawFrom: string | undefined,
  to: RestaurantPaymentStatus
): void {
  if (!canTransitionRestaurantPayment(rawFrom, to)) {
    const from = normalizeRestaurantPaymentStatusForTransition(rawFrom);
    throw new Error(
      `Invalid restaurant payment status transition: "${rawFrom ?? ""}" → "${to}". ` +
        `(normalized from: ${from}; expected exactly one step forward in RESTAURANT_PAYMENT_STATUS_SEQUENCE)`
    );
  }
}

export function getAllowedNextRestaurantPaymentStatuses(
  from: RestaurantPaymentStatus | null
): RestaurantPaymentStatus[] {
  if (from == null) return [];
  const i = RESTAURANT_PAYMENT_STATUS_SEQUENCE.indexOf(from);
  if (i < 0 || i >= RESTAURANT_PAYMENT_STATUS_SEQUENCE.length - 1) return [];
  return [RESTAURANT_PAYMENT_STATUS_SEQUENCE[i + 1]];
}

/** Cashier may set order to COMPLETED only after payment is PAID. */
export function canCompleteRestaurantOrderWithPayment(
  rawOrderStatus: string | undefined,
  rawPaymentStatus: string | undefined
): boolean {
  return (
    normalizeRestaurantOrderStatusForTransition(rawOrderStatus) === RestaurantOrderStatus.SERVED &&
    normalizeRestaurantPaymentStatusForTransition(rawPaymentStatus) === RestaurantPaymentStatus.PAID
  );
}

export function assertValidRestaurantOrderCompletedWithPayment(
  rawOrderStatus: string | undefined,
  rawPaymentStatus: string | undefined
): void {
  if (!canCompleteRestaurantOrderWithPayment(rawOrderStatus, rawPaymentStatus)) {
    throw new Error(
      `Cannot set order to ${RestaurantOrderStatus.COMPLETED}: require order status SERVED and payment PAID ` +
        `(got order="${rawOrderStatus ?? ""}", payment="${rawPaymentStatus ?? ""}")`
    );
  }
}
