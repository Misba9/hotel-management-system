import { Timestamp } from "firebase-admin/firestore";
import { adminDb, getFirebaseAdminApp } from "@shared/firebase/admin";
import type { OrderFirestoreData, UserOrderListItem, UserOrdersApiResponse } from "@shared/types/domain";
import { summarizeOrderItems } from "@shared/utils/order-items-summary";
import { RequestUserAuthError, resolveRequestUser } from "@shared/utils/request-user";

const CACHE_HEADERS = { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" };
export const dynamic = "force-dynamic";

function createdAtToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "string" && value) return value;
  return new Date(0).toISOString();
}

export async function GET(request: Request) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[api/user/orders] Admin app:", getFirebaseAdminApp() ? "initialized" : "not initialized", "| Firestore:", adminDb);
    }

    const adminApp = getFirebaseAdminApp();
    if (!adminApp) {
      console.error("[api/user/orders] Firebase Admin is not configured (missing service account env).");
      const body: UserOrdersApiResponse = { error: "Server storage is not configured." };
      return Response.json(body, { status: 503 });
    }

    const user = await resolveRequestUser(request);
    const snap = await adminDb.collection("orders").where("userId", "==", user.userId).orderBy("createdAt", "desc").limit(100).get();

    if (snap.empty) {
      const body: UserOrdersApiResponse = { success: true, items: [] };
      return Response.json(body, { status: 200, headers: CACHE_HEADERS });
    }

    const items: UserOrderListItem[] = snap.docs.map((doc) => {
      const data = doc.data() as OrderFirestoreData;
      const lineItems = data.items;
      const row: UserOrderListItem = {
        id: doc.id,
        amount: Number(data.totalAmount ?? data.total ?? 0),
        status: String(data.status ?? "pending"),
        createdAt: createdAtToIso(data.createdAt),
        address: data.address ?? undefined,
        trackingId: data.trackingId ?? undefined,
        itemsSummary: summarizeOrderItems(lineItems),
        paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : undefined,
        paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined
      };
      return row;
    });
    const body: UserOrdersApiResponse = { success: true, items };
    return Response.json(body, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      const body: UserOrdersApiResponse = { error: "Authentication required." };
      return Response.json(body, { status: 401 });
    }
    console.error("Failed to fetch orders.", error);
    const body: UserOrdersApiResponse = { error: "Failed to fetch orders." };
    return Response.json(body, { status: 500 });
  }
}
