import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const printerSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["wifi", "bluetooth"]),
  role: z.enum(["counter", "kitchen"]).optional(),
  ipAddress: z.string().max(120).optional()
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_printers_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("printers").get();
    const printers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ printers }, { status: 200 });
  } catch {
    return Response.json({ error: "Failed to fetch printers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_printers_post", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = printerSchema.parse(await request.json());
    const ref = adminDb.collection("printers").doc();
    await ref.set({
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return Response.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Failed to create printer." }, { status: 500 });
  }
}
