import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { rapidoTrackRide } from "@/lib/rapido-client";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ rideId: string }> }
) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "rapido_track", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { rideId } = await context.params;
    const tracking = await rapidoTrackRide(rideId);

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (orderId) {
      await adminDb.collection("rapidoDeliveries").doc(orderId).set(
        {
          rideId,
          tracking,
          status: tracking.status ?? "unknown",
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );

      await adminDb.collection("orders").doc(orderId).set(
        {
          rapidoStatus: tracking.status ?? "unknown",
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    }

    return Response.json({ ok: true, tracking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
