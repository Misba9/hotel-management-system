import { Timestamp, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "no-store" };

const orderStatusFilterSchema = z.enum(["all", "pending", "preparing", "ready", "delivered"]).optional();
const MAX_ORDER_PAGE_SIZE = 100;

export type OrderListItem = {
  id: string;
  customerName: string;
  phone: string;
  items: unknown[];
  totalAmount: number;
  status: string;
  createdAt: string | null;
};

function serializeCreatedAt(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const s = (value as { seconds: number; nanoseconds?: number }).seconds;
    const ns = (value as { nanoseconds?: number }).nanoseconds ?? 0;
    if (typeof s === "number") return new Timestamp(s, ns).toDate().toISOString();
  }
  return null;
}

function mapOrderDoc(doc: QueryDocumentSnapshot): OrderListItem {
  const d = doc.data();
  const totalAmount =
    typeof d.totalAmount === "number"
      ? d.totalAmount
      : typeof d.total === "number"
        ? d.total
        : 0;
  return {
    id: doc.id,
    customerName: String(d.customerName ?? ""),
    phone: String(d.phone ?? ""),
    items: Array.isArray(d.items) ? d.items : [],
    totalAmount,
    status: String(d.status ?? ""),
    createdAt: serializeCreatedAt(d.createdAt)
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_orders_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedStatus = orderStatusFilterSchema.safeParse(searchParams.get("status") ?? undefined);
    if (!parsedStatus.success) {
      return Response.json({ error: "Invalid status filter." }, { status: 400 });
    }
    const status = parsedStatus.data;
    const cursorId = searchParams.get("cursor");
    const pageSize = Math.min(Number(searchParams.get("limit") ?? 30) || 30, MAX_ORDER_PAGE_SIZE);

    const base = () => adminDb.collection("orders");

    let query: Query = base().orderBy("createdAt", "desc");
    if (status === "pending" || status === "preparing" || status === "ready" || status === "delivered") {
      query = base().where("status", "==", status).orderBy("createdAt", "desc");
    }

    if (cursorId) {
      const cursorSnap = await adminDb.collection("orders").doc(cursorId).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const snap = await query.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const items = pageDocs.map((doc) => mapOrderDoc(doc));
    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return Response.json({ items, hasMore, nextCursor }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Orders GET error:", error);
    }
    return Response.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
