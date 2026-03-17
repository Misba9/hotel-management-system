import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" };

const orderStatusFilterSchema = z
  .enum(["all", "pending", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"])
  .optional();
const MAX_ORDER_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_orders_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const { searchParams } = new URL(request.url);
    const parsedStatus = orderStatusFilterSchema.safeParse(searchParams.get("status") ?? undefined);
    if (!parsedStatus.success) {
      return Response.json({ error: "Invalid status filter." }, { status: 400 });
    }
    const status = parsedStatus.data;
    const cursor = searchParams.get("cursor");
    const pageSize = Math.min(Number(searchParams.get("limit") ?? 30), MAX_ORDER_PAGE_SIZE);
    let query = adminDb.collection("orders").orderBy("createdAt", "desc");
    if (status && status !== "all") {
      query = adminDb.collection("orders").where("status", "==", status).orderBy("createdAt", "desc");
    }
    if (cursor) {
      query = query.startAfter(cursor);
    }
    const snap = await query.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const items = pageDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const nextCursor = hasMore ? String(pageDocs[pageDocs.length - 1].data().createdAt ?? "") : null;
    return Response.json({ items, hasMore, nextCursor }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Orders GET error:", error);
    }
    return Response.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
