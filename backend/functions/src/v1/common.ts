import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

/** Opt-in: set `FIREBASE_FUNCTIONS_ENFORCE_APP_CHECK=true` after every client sends App Check (web + native staff). */
const enforceAppCheck = process.env.FIREBASE_FUNCTIONS_ENFORCE_APP_CHECK === "true";
import { z, ZodError } from "zod";
import type { Request } from "firebase-functions/v2/https";

export const db = getFirestore();
export const auth = getAuth();

/** Firestore mirrors for former RTDB paths `orderFeeds/{orderId}` and `deliveryTracking/{orderId}`. */
export async function syncOrderFeedDoc(orderId: string, data: Record<string, unknown>, merge = true) {
  await db.collection("orderFeeds").doc(orderId).set(data, { merge });
}

async function mergeDeliveryLocationMirror(orderId: string, data: Record<string, unknown>) {
  const lat = data.lat;
  const lng = data.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return;
  const orderSnap = await db.collection("orders").doc(orderId).get();
  const userId = String(orderSnap.data()?.userId ?? "");
  const etaRaw = data.etaMinutes ?? data.estimatedMinutes;
  const etaMinutes = typeof etaRaw === "number" && Number.isFinite(etaRaw) ? etaRaw : undefined;
  await db
    .collection("deliveryLocations")
    .doc(orderId)
    .set(
      {
        orderId,
        userId,
        lat,
        lng,
        ...(etaMinutes !== undefined ? { etaMinutes } : {}),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

export async function syncDeliveryTrackingDoc(orderId: string, data: Record<string, unknown>, merge = true) {
  await db.collection("deliveryTracking").doc(orderId).set(data, { merge });
  try {
    await mergeDeliveryLocationMirror(orderId, data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[deliveryLocations] mirror skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

export const COLLECTIONS = {
  users: "users",
  products: "products",
  categories: "categories",
  orders: "orders",
  orderItems: "orderItems",
  payments: "payments",
  delivery: "delivery",
  notifications: "notifications",
  settings: "settings",
  invoices: "invoices"
} as const;

export const orderStatusSchema = z.enum([
  "created",
  "confirmed",
  "pending",
  "accepted",
  "rejected",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);

/** Strict linear pipeline — use for all `orders.status` *transitions* (not order creation). */
export const orderLifecycleStatusSchema = z.enum([
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered"
]);

export const paymentMethodSchema = z.enum(["cash", "upi", "online"]);
export const paymentStatusSchema = z.enum(["pending", "paid", "failed", "refunded"]);
export const deliveryStatusSchema = z.enum(["assigned", "picked_up", "on_the_way", "delivered", "failed"]);
export const userRoleSchema = z.enum(["customer", "kitchen_staff", "waiter", "cashier", "delivery_boy", "manager", "admin"]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export function createTimestamp() {
  return new Date().toISOString();
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(JSON.stringify({ level: "info", message, ...context }));
  }
}

export function logError(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.error(JSON.stringify({ level: "error", message, ...context }));
  }
}

export function assertAuthed(authContext: { uid?: string } | null | undefined) {
  if (!authContext?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return authContext.uid;
}

export function assertRole(role: string, allowed: UserRole[]) {
  if (!allowed.includes(role as UserRole)) {
    throw new HttpsError("permission-denied", "You do not have permission for this action.");
  }
}

function normalizeError(error: unknown) {
  if (error instanceof HttpsError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new HttpsError("invalid-argument", "Validation failed.", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  logError("Unhandled error", {
    error: error instanceof Error ? error.message : String(error)
  });
  return new HttpsError("internal", "Internal server error.");
}

export function withCallableGuard<TInput, TResult>(
  handler: (input: TInput, ctx: { uid: string; role: string }) => Promise<TResult>,
  schema: z.ZodType<TInput>
) {
  return onCall({ enforceAppCheck }, async (request) => {
    try {
      const uid = assertAuthed(request.auth);
      const userRecord = await auth.getUser(uid);
      const role = String(userRecord.customClaims?.role ?? "customer");
      const payload = schema.parse(request.data);
      return await handler(payload, { uid, role });
    } catch (error) {
      throw normalizeError(error);
    }
  });
}

export async function authenticateHttp(request: Request) {
  const authHeader = request.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Missing Bearer token.");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new HttpsError("unauthenticated", "Missing token.");
  }
  const decoded = await auth.verifyIdToken(token);
  return {
    uid: decoded.uid,
    role: String(decoded.role ?? "customer")
  };
}

export function withHttpGuard(
  handler: (request: Request, identity: { uid: string; role: string }) => Promise<{ status: number; body: unknown }>
) {
  return onRequest(async (request, response) => {
    try {
      const identity = await authenticateHttp(request);
      const result = await handler(request, identity);
      response.status(result.status).json(result.body);
    } catch (error) {
      const normalized = normalizeError(error);
      response.status(mapHttpsCodeToHttp(normalized.code)).json({
        success: false,
        error: normalized.message,
        details: normalized.details ?? null
      });
    }
  });
}

function mapHttpsCodeToHttp(code: HttpsError["code"]) {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "unauthenticated":
      return 401;
    case "permission-denied":
      return 403;
    case "not-found":
      return 404;
    case "already-exists":
      return 409;
    case "resource-exhausted":
      return 429;
    default:
      return 500;
  }
}
