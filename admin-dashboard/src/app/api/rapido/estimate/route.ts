import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { rapidoEstimateRide } from "@/lib/rapido-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.string().min(1),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number()
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "rapido_estimate", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid payload." }, { status: 400 });
    }

    const estimate = await rapidoEstimateRide(parsed.data);

    await adminDb.collection("rapidoDeliveries").doc(parsed.data.orderId).set(
      {
        orderId: parsed.data.orderId,
        estimate,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );

    return Response.json({ ok: true, estimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Estimate failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
