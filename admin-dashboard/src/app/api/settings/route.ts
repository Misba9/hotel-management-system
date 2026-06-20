import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { DEFAULT_POS_SETTINGS, POS_SETTINGS_DOC_ID, type PosSettingsDoc } from "@shared/types/pos-settings";
import { z } from "zod";

const SETTINGS_DOC = "business";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" };
const settingsSchema = z.object({
  businessHours: z.string().min(3).max(120).optional(),
  deliveryRadiusKm: z.number().min(1).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  paymentProvider: z.enum(["razorpay", "manual"]).optional(),
  upiVpa: z.string().max(120).optional(),
  upiBankName: z.string().max(120).optional(),
  enabledPaymentMethods: z.array(z.enum(["cash", "upi", "card", "wallet", "split"])).optional(),
  counterPrinterId: z.string().max(80).optional(),
  kitchenPrinterId: z.string().max(80).optional()
});

async function loadPosSettings(): Promise<PosSettingsDoc> {
  const snap = await adminDb.collection("settings").doc(POS_SETTINGS_DOC_ID).get();
  if (!snap.exists) return { ...DEFAULT_POS_SETTINGS };
  return { ...DEFAULT_POS_SETTINGS, ...(snap.data() as Partial<PosSettingsDoc>) };
}

async function syncPosSettings(patch: Partial<PosSettingsDoc> & { taxPercent?: number }) {
  const cur = await loadPosSettings();
  const next: PosSettingsDoc = {
    ...cur,
    ...(patch.taxPercent !== undefined ? { taxPercent: patch.taxPercent } : {}),
    ...(patch.paymentProvider !== undefined ? { paymentProvider: patch.paymentProvider } : {}),
    ...(patch.upiVpa !== undefined ? { upiVpa: patch.upiVpa } : {}),
    ...(patch.upiBankName !== undefined ? { upiBankName: patch.upiBankName } : {}),
    ...(patch.enabledPaymentMethods !== undefined ? { enabledPaymentMethods: patch.enabledPaymentMethods } : {}),
    ...(patch.counterPrinterId !== undefined ? { counterPrinterId: patch.counterPrinterId } : {}),
    ...(patch.kitchenPrinterId !== undefined ? { kitchenPrinterId: patch.kitchenPrinterId } : {}),
    updatedAt: new Date().toISOString()
  };
  await adminDb.collection("settings").doc(POS_SETTINGS_DOC_ID).set(next, { merge: true });
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_settings_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("settings").doc(SETTINGS_DOC).get();
    if (!snap.exists) {
      const pos = await loadPosSettings();
      return Response.json(
        {
          settings: {
            businessHours: "09:00 - 23:00",
            deliveryRadiusKm: 20,
            taxPercent: 5,
            discountPercent: 10,
            paymentProvider: pos.paymentProvider,
            upiVpa: pos.upiVpa ?? "",
            upiBankName: pos.upiBankName ?? "",
            enabledPaymentMethods: pos.enabledPaymentMethods,
            counterPrinterId: pos.counterPrinterId,
            kitchenPrinterId: pos.kitchenPrinterId
          }
        },
        { status: 200, headers: CACHE_HEADERS }
      );
    }
    const pos = await loadPosSettings();
    return Response.json(
      {
        settings: {
          ...(snap.data() as Record<string, unknown>),
          paymentProvider: pos.paymentProvider,
          upiVpa: pos.upiVpa ?? "",
          upiBankName: pos.upiBankName ?? "",
          enabledPaymentMethods: pos.enabledPaymentMethods,
          counterPrinterId: pos.counterPrinterId,
          kitchenPrinterId: pos.kitchenPrinterId
        }
      },
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Settings GET error:", error);
    }
    return Response.json({ error: "Failed to fetch settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_settings_patch", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
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
    await syncPosSettings({
      ...(body.taxPercent !== undefined ? { taxPercent: body.taxPercent } : {}),
      ...(body.paymentProvider !== undefined ? { paymentProvider: body.paymentProvider } : {}),
      ...(body.upiVpa !== undefined ? { upiVpa: body.upiVpa } : {}),
      ...(body.upiBankName !== undefined ? { upiBankName: body.upiBankName } : {}),
      ...(body.enabledPaymentMethods !== undefined ? { enabledPaymentMethods: body.enabledPaymentMethods } : {}),
      ...(body.counterPrinterId !== undefined ? { counterPrinterId: body.counterPrinterId } : {}),
      ...(body.kitchenPrinterId !== undefined ? { kitchenPrinterId: body.kitchenPrinterId } : {})
    });
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
