import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" };
const MAX_STAFF_PAGE_SIZE = 50;

const createStaffSchema = z.object({
  name: z.string().min(2).max(120),
  role: z.enum(["delivery_boy", "kitchen_staff", "waiter", "cashier", "manager", "admin"]),
  performanceScore: z.number().int().min(0).max(100).optional()
});

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_staff_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = Math.min(Number(searchParams.get("limit") ?? 20), MAX_STAFF_PAGE_SIZE);
    const cursor = searchParams.get("cursor");
    const role = searchParams.get("role");

    let query = adminDb.collection("staff").orderBy("performanceScore", "desc");
    if (role && role !== "all") {
      query = adminDb.collection("staff").where("role", "==", role).orderBy("performanceScore", "desc");
    }
    if (cursor) {
      query = query.startAfter(Number(cursor));
    }

    const snap = await query.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const items = pageDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const nextCursor = hasMore ? String(pageDocs[pageDocs.length - 1].data().performanceScore ?? "") : null;

    return Response.json({ items, hasMore, nextCursor }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Staff GET error:", error);
    }
    return Response.json({ error: "Failed to fetch staff." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_staff_post", limit: 30, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = createStaffSchema.parse(await request.json());
    const ref = adminDb.collection("staff").doc();
    await ref.set({
      id: ref.id,
      userId: ref.id,
      branchId: "hyderabad-main",
      name: body.name,
      role: body.role,
      active: true,
      online: false,
      activeOrders: 0,
      performanceScore: Number(body.performanceScore ?? 80)
    });
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Staff POST error:", error);
    }
    return Response.json({ error: "Failed to create staff record." }, { status: 500 });
  }
}
