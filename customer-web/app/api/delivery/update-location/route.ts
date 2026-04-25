import { NextResponse } from "next/server";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { mergeDeliveryLocationDoc } from "@shared/utils/delivery-locations-admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  orderId: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  etaMinutes: z.number().optional()
});

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin", "manager", "delivery_boy"],
    rateLimit: { keyPrefix: "delivery_update_loc", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const body = bodySchema.parse(await request.json());
    await mergeDeliveryLocationDoc(body.orderId, {
      lat: body.lat,
      lng: body.lng,
      etaMinutes: body.etaMinutes
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid payload." }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[delivery/update-location]", error);
    }
    return NextResponse.json({ success: false, error: "Could not update location." }, { status: 500 });
  }
}
