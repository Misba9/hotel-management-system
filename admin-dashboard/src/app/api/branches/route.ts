import { adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";

const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  deliveryRadiusKm: z.number().min(1).max(100).optional()
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_branches_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const snap = await adminDb.collection("branches").orderBy("name").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ items }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Branches GET error:", error);
    }
    return Response.json({ error: "Failed to fetch branches." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_branches_post", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;
  try {
    const body = branchCreateSchema.parse(await request.json());
    const ref = adminDb.collection("branches").doc();
    await ref.set({
      id: ref.id,
      name: body.name,
      city: body.city,
      address: "",
      location: { lat: 17.4126, lng: 78.4482 },
      deliveryRadiusKm: Number(body.deliveryRadiusKm ?? 20),
      active: true
    });
    return Response.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Branches POST error:", error);
    }
    return Response.json({ error: "Failed to create branch." }, { status: 500 });
  }
}
