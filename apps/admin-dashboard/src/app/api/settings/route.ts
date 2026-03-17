import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const SETTINGS_DOC = "business";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" };
const settingsSchema = z.object({
  businessHours: z.string().min(3).max(120).optional(),
  deliveryRadiusKm: z.number().min(1).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  discountPercent: z.number().min(0).max(100).optional()
});

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_settings_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const snap = await adminDb.collection("settings").doc(SETTINGS_DOC).get();
    if (!snap.exists) {
      return Response.json(
        {
          settings: {
            businessHours: "09:00 - 23:00",
            deliveryRadiusKm: 20,
            taxPercent: 5,
            discountPercent: 10
          }
        },
        { status: 200, headers: CACHE_HEADERS }
      );
    }
    return Response.json({ settings: snap.data() }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Settings GET error:", error);
    }
    return Response.json({ error: "Failed to fetch settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_settings_patch", limit: 40, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const body = settingsSchema.parse(await request.json());
    await adminDb.collection("settings").doc(SETTINGS_DOC).set(
      {
        ...(body.businessHours !== undefined ? { businessHours: body.businessHours } : {}),
        ...(body.deliveryRadiusKm !== undefined ? { deliveryRadiusKm: Number(body.deliveryRadiusKm) } : {}),
        ...(body.taxPercent !== undefined ? { taxPercent: Number(body.taxPercent) } : {}),
        ...(body.discountPercent !== undefined ? { discountPercent: Number(body.discountPercent) } : {}),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Settings PATCH error:", error);
    }
    return Response.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
