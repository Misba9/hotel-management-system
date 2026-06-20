import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { rapidoBookRide } from "@/lib/rapido-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.string().min(1),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number(),
  pickupAddress: z.string().min(3),
  dropAddress: z.string().min(3),
  customerName: z.string().min(1),
  customerPhone: z.string().min(6)
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "rapido_book", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid payload." }, { status: 400 });
    }

    const booking = await rapidoBookRide(parsed.data);

    await adminDb.collection("orders").doc(parsed.data.orderId).set(
      {
        rapidoRideId: booking.rideId ?? null,
        rapidoStatus: booking.status ?? "booked",
        deliveryProvider: "rapido",
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );

    await adminDb.collection("rapidoDeliveries").doc(parsed.data.orderId).set(
      {
        orderId: parsed.data.orderId,
        booking,
        status: booking.status ?? "booked",
        rideId: booking.rideId ?? null,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );

    return Response.json({ ok: true, booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
