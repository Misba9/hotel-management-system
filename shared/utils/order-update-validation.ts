import {
  ORDER_LIFECYCLE,
  canTransition,
  normalizeCurrentForTransition,
  type OrderLifecycleStatus
} from "./order-status-lifecycle";
import {
  RestaurantOrderStatus,
  canTransitionRestaurantOrder,
  normalizeRestaurantOrderStatusForTransition,
  normalizeRestaurantPaymentStatusForTransition,
  RestaurantPaymentStatus,
  tryParseRestaurantOrderStatus
} from "./restaurant-order-status";

export type OrderUpdateValidationResult = { ok: true } | { ok: false; code: string; message: string };

function fail(code: string, message: string): OrderUpdateValidationResult {
  return { ok: false, code, message };
}

/** Same logical status (case-insensitive); skips redundant transition checks. */
export function orderStatusesEffectivelyEqual(a: string | undefined, b: string | undefined): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Target restaurant order status from an incoming string (override / write).
 * Terminal names return `"terminal"`; unmapped returns `null`.
 */
export function parseRestaurantOrderTarget(
  raw: string
): RestaurantOrderStatus | "terminal" | null {
  return tryParseRestaurantOrderStatus(raw);
}

/**
 * Table / dine-in: one step forward on {@link RESTAURANT_ORDER_STATUS_SEQUENCE}, or terminal status.
 * Blocks jumps such as PLACED → READY.
 */
export function validateRestaurantOrderStatusStep(
  fromStatus: string | undefined,
  toStatusRaw: string
): OrderUpdateValidationResult {
  const target = parseRestaurantOrderTarget(toStatusRaw);
  if (target === null) {
    return fail("INVALID_STATUS", `Unknown restaurant order status: "${toStatusRaw}".`);
  }
  if (target === "terminal") return { ok: true };

  if (!canTransitionRestaurantOrder(fromStatus, target)) {
    const from = normalizeRestaurantOrderStatusForTransition(fromStatus);
    return fail(
      "STATUS_JUMP",
      `Invalid status change: cannot go from "${fromStatus ?? ""}" to "${toStatusRaw}". ` +
        `Advance one step at a time (normalized from: ${from === "blocked" ? "blocked/terminal" : from}).`
    );
  }
  return { ok: true };
}

function parseDeliveryLifecycleTarget(raw: string): OrderLifecycleStatus | "terminal" | null {
  const lower = raw.trim().toLowerCase();
  if (lower === "cancelled" || lower === "canceled" || lower === "rejected" || lower === "refunded") {
    return "terminal";
  }
  if (lower === "created" || lower === "confirmed") return "pending";
  if (lower === "completed") return "delivered";
  if ((ORDER_LIFECYCLE as readonly string[]).includes(lower)) {
    return lower as OrderLifecycleStatus;
  }
  return null;
}

/**
 * Delivery-style orders: one step on {@link ORDER_LIFECYCLE}, or terminal status.
 */
export function validateDeliveryOrderStatusStep(
  fromStatus: string | undefined,
  toStatusRaw: string
): OrderUpdateValidationResult {
  const target = parseDeliveryLifecycleTarget(toStatusRaw);
  if (target === null) {
    return fail("INVALID_STATUS", `Unknown delivery order status: "${toStatusRaw}".`);
  }
  if (target === "terminal") return { ok: true };

  if (!canTransition(fromStatus, target)) {
    const from = normalizeCurrentForTransition(fromStatus);
    return fail(
      "STATUS_JUMP",
      `Invalid status change: cannot go from "${fromStatus ?? ""}" to "${toStatusRaw}". ` +
        `(normalized from: ${from === "blocked" ? "blocked/terminal" : from}; expected exactly one step forward in the delivery lifecycle.)`
    );
  }
  return { ok: true };
}

export function isRestaurantFloorOrderType(orderType: string | undefined): boolean {
  const o = String(orderType ?? "").toLowerCase();
  return o === "table" || o === "dine_in";
}

/**
 * Routes to restaurant vs delivery single-step rules from `orderType`.
 */
export function validateOrderStatusUpdate(input: {
  orderType: string | undefined;
  currentStatus: string | undefined;
  nextStatus: string;
}): OrderUpdateValidationResult {
  if (isRestaurantFloorOrderType(input.orderType)) {
    return validateRestaurantOrderStatusStep(input.currentStatus, input.nextStatus);
  }
  return validateDeliveryOrderStatusStep(input.currentStatus, input.nextStatus);
}

/**
 * Table tickets: `paymentStatus` may become PAID only after REQUESTED (bill requested).
 */
export function validateMarkTableOrderPaid(currentPaymentStatus: string | undefined): OrderUpdateValidationResult {
  const p = normalizeRestaurantPaymentStatusForTransition(currentPaymentStatus);
  /** Counter can close after bill request, or directly when still PENDING after serve (see Firestore table rules). */
  if (p === RestaurantPaymentStatus.REQUESTED || p === RestaurantPaymentStatus.PENDING) return { ok: true };
  return fail(
    "PAID_BEFORE_REQUESTED",
    "Payment cannot be marked PAID until the bill is open (paymentStatus must be PENDING or REQUESTED)."
  );
}

/**
 * Setting `tables/{id}.status` to FREE is allowed only when the linked ticket is (or will be) COMPLETED.
 * Pass the order status after the update (e.g. `"COMPLETED"` when batching complete + free).
 */
export function validateFreeTableRequiresOrderCompleted(
  orderStatusAfterUpdate: string | undefined
): OrderUpdateValidationResult {
  const canon = normalizeRestaurantOrderStatusForTransition(orderStatusAfterUpdate);
  if (canon === RestaurantOrderStatus.COMPLETED) return { ok: true };
  return fail(
    "TABLE_FREE_BEFORE_COMPLETED",
    "Table cannot be set FREE until the table order is COMPLETED."
  );
}

/**
 * Validates cashier complete-payment batch: REQUESTED → PAID, SERVED → COMPLETED in one step, then FREE table.
 */
export function validateTableOrderCompleteAndFreeTable(input: {
  currentOrderStatus: string | undefined;
  currentPaymentStatus: string | undefined;
}): OrderUpdateValidationResult {
  const payCheck = validateMarkTableOrderPaid(input.currentPaymentStatus);
  if (!payCheck.ok) return payCheck;

  const stepCheck = validateRestaurantOrderStatusStep(
    input.currentOrderStatus,
    RestaurantOrderStatus.COMPLETED
  );
  if (!stepCheck.ok) return stepCheck;

  return validateFreeTableRequiresOrderCompleted(RestaurantOrderStatus.COMPLETED);
}

export function assertOrderUpdateValid(result: OrderUpdateValidationResult): asserts result is { ok: true } {
  if (!result.ok) throw new Error(result.message);
}
