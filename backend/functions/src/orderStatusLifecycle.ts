/**
 * @deprecated Import from shared in apps — duplicated here because Functions `tsconfig` rootDir is `src/`.
 * Keep in sync with `shared/utils/order-status-lifecycle.ts`.
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

const BLOCKED = new Set(["cancelled", "canceled", "rejected", "refunded"]);

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
        `(from normalized: ${from === "blocked" ? "blocked" : from})`
    );
  }
}
