/**
 * Strict linear order lifecycle (single forward path, no skips, no backward).
 * Keep in sync with `backend/functions/src/orderStatusLifecycle.ts` (Functions rootDir).
 */

export const ORDER_LIFECYCLE = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered"
] as const;

export type OrderLifecycleStatus = (typeof ORDER_LIFECYCLE)[number];

/** Terminal / non-lifecycle states — block transitions via this helper. */
const BLOCKED = new Set(["cancelled", "canceled", "rejected", "refunded"]);

/**
 * Map Firestore `status` to a position on the lifecycle line.
 * Legacy `created` / `confirmed` count as `pending`.
 * Unknown values are treated as `pending` so old rows can still advance one step forward.
 */
export function normalizeCurrentForTransition(raw: string | undefined): OrderLifecycleStatus | "blocked" {
  const s = String(raw ?? "pending").toLowerCase().trim();
  if (BLOCKED.has(s)) return "blocked";
  if (s === "created" || s === "confirmed" || s === "pending") return "pending";
  if ((ORDER_LIFECYCLE as readonly string[]).includes(s)) return s as OrderLifecycleStatus;
  return "pending";
}

export function canTransition(rawFrom: string | undefined, to: OrderLifecycleStatus): boolean {
  const from = normalizeCurrentForTransition(rawFrom);
  if (from === "blocked") return false;
  const i = ORDER_LIFECYCLE.indexOf(from);
  const j = ORDER_LIFECYCLE.indexOf(to);
  if (i < 0 || j < 0) return false;
  return j === i + 1;
}

export function assertValidTransition(rawFrom: string | undefined, to: OrderLifecycleStatus): void {
  if (!canTransition(rawFrom, to)) {
    const from = normalizeCurrentForTransition(rawFrom);
    throw new Error(
      `Invalid order status transition: "${rawFrom ?? ""}" → "${to}". ` +
        `(normalized from: ${from === "blocked" ? "blocked/terminal" : from}; expected exactly one step forward in ORDER_LIFECYCLE)`
    );
  }
}

export function getAllowedNext(from: OrderLifecycleStatus | null): OrderLifecycleStatus[] {
  if (from == null) return [];
  const i = ORDER_LIFECYCLE.indexOf(from);
  if (i < 0 || i >= ORDER_LIFECYCLE.length - 1) return [];
  return [ORDER_LIFECYCLE[i + 1]];
}
