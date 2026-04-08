import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";

export const dynamic = "force-dynamic";

const MAX_IDS = 40;
const IN_CHUNK = 10;

/**
 * GET — Batch average rating + count per product id (`?ids=a,b,c`).
 */
export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "reviews_summary", limit: 90, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const url = new URL(request.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);

  if (ids.length === 0) {
    return Response.json({ summaries: {} as Record<string, { average: number; count: number }> });
  }

  const agg: Record<string, { sum: number; count: number }> = {};
  for (const id of ids) {
    agg[id] = { sum: 0, count: 0 };
  }

  try {
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const batch = ids.slice(i, i + IN_CHUNK);
      const snap = await adminDb.collection("reviews").where("productId", "in", batch).get();
      snap.forEach((doc) => {
        const d = doc.data();
        const pid = d.productId as string;
        const rating = d.rating;
        if (typeof pid !== "string" || !agg[pid] || typeof rating !== "number") return;
        agg[pid].sum += rating;
        agg[pid].count += 1;
      });
    }

    const summaries: Record<string, { average: number; count: number }> = {};
    for (const id of ids) {
      const { sum, count } = agg[id];
      summaries[id] = {
        count,
        average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0
      };
    }

    return Response.json({ summaries });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[reviews/summary GET]", error);
    }
    return Response.json({ error: "Failed to load review summaries." }, { status: 500 });
  }
}
