import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createReviewSchema = z.object({
  productId: z.string().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(""),
  displayName: z.string().min(1).max(40).optional()
});

async function tryVerifyCustomerUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

function reviewCreatedAtMs(value: unknown): number | null {
  if (value && typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * GET — List reviews for a product (newest first).
 * Uses `where` only (no composite index), sorts in memory — avoids Firestore index errors.
 */
export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "reviews_list", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim() ?? "";
  if (!productId) {
    return Response.json({ reviews: [] });
  }

  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;

  try {
    const fetchCap = Math.min(200, Math.max(limit * 4, limit));
    const snap = await adminDb
      .collection("reviews")
      .where("productId", "==", productId)
      .limit(fetchCap)
      .get();

    const rows = snap.docs.map((doc) => {
      const d = doc.data() ?? {};
      const createdAt = reviewCreatedAtMs(d.createdAt);
      const rating = typeof d.rating === "number" && Number.isFinite(d.rating) ? Math.round(d.rating) : 0;
      return {
        id: doc.id,
        productId: typeof d.productId === "string" ? d.productId : productId,
        rating: Math.min(5, Math.max(0, rating)),
        comment: typeof d.comment === "string" ? d.comment : "",
        displayName: typeof d.displayName === "string" ? d.displayName : null,
        createdAt
      };
    });

    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const reviews = rows.slice(0, limit);

    return Response.json({ reviews });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[reviews GET]", error);
    }
    return Response.json({ reviews: [] });
  }
}

/**
 * POST — Create a review (one per user per product).
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "reviews_create", limit: 15, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const body = createReviewSchema.parse(await request.json());
    const customerUid = await tryVerifyCustomerUid(request);
    if (!customerUid) {
      return Response.json({ error: "Authentication required to submit a review." }, { status: 401 });
    }
    const userId = customerUid;

    const dup = await adminDb
      .collection("reviews")
      .where("productId", "==", body.productId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (!dup.empty) {
      return Response.json({ error: "You already submitted a review for this product." }, { status: 409 });
    }

    const ref = adminDb.collection("reviews").doc();
    const now = FieldValue.serverTimestamp();
    const comment = body.comment.trim();
    const displayName = body.displayName?.trim();

    await ref.set({
      id: ref.id,
      productId: body.productId,
      userId,
      rating: body.rating,
      comment,
      ...(displayName ? { displayName } : {}),
      createdAt: now,
      updatedAt: now
    });

    return Response.json({ success: true, id: ref.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid review payload.", details: error.flatten() }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[reviews POST]", error);
    }
    return Response.json({ error: "Failed to save review." }, { status: 500 });
  }
}
