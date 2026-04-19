import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { verifySignedTrackingToken } from "@shared/utils/tracking-token";

export const dynamic = "force-dynamic";

function defaultRestaurantLocation(): { lat: number; lng: number } {
  const lat = Number(process.env.NEXT_PUBLIC_RESTAURANT_LAT ?? process.env.RESTAURANT_LAT ?? "17.4126");
  const lng = Number(process.env.NEXT_PUBLIC_RESTAURANT_LNG ?? process.env.RESTAURANT_LNG ?? "78.4482");
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: 17.4126, lng: 78.4482 };
}

function parseLatLng(obj: unknown): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

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
  let realtimeTracking: Record<string, unknown> | null = null;
  try {
    const realtimeSnap = await adminDb.collection("deliveryTracking").doc(internalOrderId).get();
    realtimeTracking = realtimeSnap.exists ? { ...(realtimeSnap.data() as Record<string, unknown>) } : null;
  } catch {
    realtimeTracking = null;
  }

  try {
    const locSnap = await adminDb.collection("deliveryLocations").doc(internalOrderId).get();
    if (locSnap.exists) {
      const L = locSnap.data() as Record<string, unknown>;
      const base = realtimeTracking ?? {};
      realtimeTracking = {
        ...base,
        ...(typeof L.lat === "number" ? { lat: L.lat } : {}),
        ...(typeof L.lng === "number" ? { lng: L.lng } : {}),
        ...(typeof L.etaMinutes === "number" ? { etaMinutes: L.etaMinutes } : {})
      };
    }
  } catch {
    /* ignore */
  }

  const raw = byTrackingSnap.empty ? (await adminDb.collection("orders").doc(internalOrderId).get()).data() : byTrackingSnap.docs[0].data();

  try {
    const orderRow = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const riderFromOrder = orderRow ? parseLatLng(orderRow.riderLocation) : null;
    if (riderFromOrder) {
      const base = realtimeTracking ?? {};
      realtimeTracking = {
        ...base,
        lat: riderFromOrder.lat,
        lng: riderFromOrder.lng
      };
    }
  } catch {
    /* ignore */
  }
  const createdAtRaw = raw && typeof raw === "object" && "createdAt" in raw ? (raw as { createdAt?: unknown }).createdAt : undefined;
  let createdAtIso = "";
  if (createdAtRaw && typeof createdAtRaw === "object" && createdAtRaw !== null && "toDate" in createdAtRaw) {
    createdAtIso = (createdAtRaw as { toDate: () => Date }).toDate().toISOString();
  } else if (typeof createdAtRaw === "string") {
    createdAtIso = createdAtRaw;
  }
  const estRaw =
    raw && typeof raw === "object"
      ? (raw as { estimatedDeliveryAt?: unknown; estimatedDeliveryBy?: unknown }).estimatedDeliveryAt ??
        (raw as { estimatedDeliveryBy?: unknown }).estimatedDeliveryBy
      : undefined;
  const estimatedDeliveryAt =
    typeof estRaw === "string"
      ? estRaw
      : estRaw && typeof estRaw === "object" && estRaw !== null && "toDate" in estRaw
        ? (estRaw as { toDate: () => Date }).toDate().toISOString()
        : undefined;

  const orderRow = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const deliveryCoords = orderRow?.deliveryAddress ? parseLatLng(orderRow.deliveryAddress) : null;

  return NextResponse.json({
    orderId: internalOrderId,
    trackingId: order.trackingId ?? trackingId,
    status: order.status,
    updatedAt: order.updatedAt,
    createdAt: createdAtIso || undefined,
    estimatedDeliveryAt,
    orderType: order.orderType,
    delivery,
    realtimeTracking,
    restaurantLocation: defaultRestaurantLocation(),
    deliveryCoords
  }, { headers: CACHE_HEADERS });
}
