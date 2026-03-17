import { adminDb } from "@shared/firebase/admin";
import { RequestUserAuthError, resolveAuthenticatedRequestUser } from "@shared/utils/request-user";

const CACHE_HEADERS = { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" };
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await resolveAuthenticatedRequestUser(request);
    const snap = await adminDb.collection("orders").where("userId", "==", user.userId).orderBy("createdAt", "desc").limit(100).get();
    const items = snap.docs.map((doc) => {
      const data = doc.data() as {
        total?: number;
        status?: string;
        createdAt?: string;
        address?: string | null;
        trackingId?: string;
      };
      return {
        id: doc.id,
        amount: Number(data.total ?? 0),
        status: String(data.status ?? "pending"),
        createdAt: String(data.createdAt ?? new Date(0).toISOString()),
        address: data.address ?? undefined,
        trackingId: data.trackingId ?? undefined
      };
    });
    return Response.json({ success: true, items }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (error instanceof RequestUserAuthError) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    console.error("Failed to fetch orders.", error);
    return Response.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
