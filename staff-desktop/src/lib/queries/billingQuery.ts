import { collection, limit, orderBy, query, where, type Query } from "firebase/firestore";
import { firestoreDb } from "@/lib/staff-db";

/** Served / ready tickets awaiting payment (case variants in DB). */
const BILLING_STATUS_IN = ["ready", "served", "READY", "SERVED"] as const;

const BILLING_STATUS_SET = new Set(BILLING_STATUS_IN.map((s) => s.toLowerCase()));

const PENDING_PAYMENT = new Set(["pending", "PENDING"]);

let billingQuerySingleton: Query | null | undefined;
let billingFallbackQuerySingleton: Query | null | undefined;

/**
 * Cashier billing queue — exactly one `in` filter (Firestore allows only one per query).
 * Pending payment is filtered in the snapshot handler via {@link isBillingPendingPayment}.
 */
export function getBillingQuery(): Query | null {
  if (billingQuerySingleton !== undefined) return billingQuerySingleton;
  if (!firestoreDb) {
    console.warn("[billingQuery] Firestore is not initialized.");
    billingQuerySingleton = null;
    return null;
  }
  try {
    billingQuerySingleton = query(
      collection(firestoreDb, "orders"),
      where("status", "in", [...BILLING_STATUS_IN]),
      orderBy("createdAt", "desc")
    );
  } catch (e) {
    console.warn("[billingQuery] Failed to build query:", e);
    billingQuerySingleton = null;
  }
  return billingQuerySingleton;
}

/**
 * Fallback when the composite index is missing: recent orders only, filter in app.
 * Composite: `status` ASC + `createdAt` DESC (see `firestore.indexes.json`).
 */
export function getBillingFallbackQuery(): Query | null {
  if (billingFallbackQuerySingleton !== undefined) return billingFallbackQuerySingleton;
  if (!firestoreDb) {
    billingFallbackQuerySingleton = null;
    return null;
  }
  try {
    billingFallbackQuerySingleton = query(
      collection(firestoreDb, "orders"),
      orderBy("createdAt", "desc"),
      limit(250)
    );
  } catch (e) {
    console.warn("[billingQuery] Failed to build fallback query:", e);
    billingFallbackQuerySingleton = null;
  }
  return billingFallbackQuerySingleton;
}

/** @deprecated Prefer {@link getBillingQuery} — kept for existing imports. */
export const billingQuery = getBillingQuery();

export function isBillingEligibleStatus(status: unknown): boolean {
  return BILLING_STATUS_SET.has(String(status ?? "").trim().toLowerCase());
}

export function isBillingPendingPayment(paymentStatus: unknown): boolean {
  const s = String(paymentStatus ?? "").trim();
  return PENDING_PAYMENT.has(s);
}
