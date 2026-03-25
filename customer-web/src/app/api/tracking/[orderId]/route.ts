import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminRtdb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { verifySignedTrackingToken } from "@shared/utils/tracking-token";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" };

type AuthContext = {
  uid: string;
  role: string;
};

function isPrivilegedRole(role: string): boolean {
  return role === "admin" || role === "manager" || role === "delivery_boy" || role === "kitchen_staff" || role === "cashier" || role === "waiter";
}

async function parseBearerAuth(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Missing bearer token.");

  const decoded = await adminAuth.verifyIdToken(token);
  return {
    uid: decoded.uid,
    role: String(decoded.role ?? "customer")
  };
}

export async function GET(request: Request, context: { params: { orderId: string } }) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "customer_tracking_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const trackingId = context.params.orderId;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const hasValidSignedToken = token ? verifySignedTrackingToken(token, trackingId) : false;

  let auth: AuthContext | null = null;
  try {
    auth = await parseBearerAuth(request);
  } catch {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const byTrackingSnap = await adminDb.collection("orders").where("trackingId", "==", trackingId).limit(1).get();
  let internalOrderId: string | null = null;
  let order:
    | {
        status: string;
        updatedAt: string;
        orderType: string;
        userId?: string;
        trackingId?: string;
      }
    | null = null;

  if (!byTrackingSnap.empty) {
    internalOrderId = byTrackingSnap.docs[0].id;
    order = byTrackingSnap.docs[0].data() as {
      status: string;
      updatedAt: string;
      orderType: string;
      userId?: string;
      trackingId?: string;
    };
  }

  // Backward compatibility for older links where URL still contains internal order ID.
  if (!order && auth && !hasValidSignedToken) {
    const fallbackSnap = await adminDb.collection("orders").doc(trackingId).get();
    if (fallbackSnap.exists) {
      internalOrderId = fallbackSnap.id;
      order = fallbackSnap.data() as {
        status: string;
        updatedAt: string;
        orderType: string;
        userId?: string;
        trackingId?: string;
      };
    }
  }

  if (!order || !internalOrderId) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const orderOwnerId = order.userId ?? "";
  const ownerAllowed = Boolean(auth?.uid && orderOwnerId && orderOwnerId !== "guest_user" && auth.uid === orderOwnerId);
  const roleAllowed = Boolean(auth?.role && isPrivilegedRole(auth.role));
  const authorized = hasValidSignedToken || ownerAllowed || roleAllowed;

  if (!authorized) {
    return NextResponse.json({ message: auth ? "Forbidden." : "Unauthorized." }, { status: auth ? 403 : 401 });
  }

  const assignmentSnap = await adminDb.collection("delivery_assignments").where("orderId", "==", internalOrderId).limit(1).get();
  const delivery = assignmentSnap.empty ? null : assignmentSnap.docs[0].data();
  const realtimeSnap = await adminRtdb.ref(`deliveryTracking/${internalOrderId}`).get();
  const realtimeTracking = realtimeSnap.exists() ? realtimeSnap.val() : null;

  return NextResponse.json({
    orderId: internalOrderId,
    trackingId: order.trackingId ?? trackingId,
    status: order.status,
    updatedAt: order.updatedAt,
    orderType: order.orderType,
    delivery,
    realtimeTracking
  }, { headers: CACHE_HEADERS });
}
