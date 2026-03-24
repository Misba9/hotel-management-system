import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const addPartnerSchema = z.object({
  mode: z.literal("add_partner"),
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(24).optional()
});

const assignOrderSchema = z.object({
  mode: z.literal("assign_order"),
  orderId: z.string().min(1),
  deliveryPartnerId: z.string().min(1)
});

export async function GET(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_delivery_get", limit: 120, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const partnersSnap = await adminDb.collection("staff").where("role", "==", "delivery_boy").orderBy("name").get();
    const assignmentsSnap = await adminDb.collection("delivery_assignments").orderBy("updatedAt", "desc").limit(50).get();
    return Response.json(
      {
        partners: partnersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        assignments: assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      },
      { status: 200 }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Delivery GET error:", error);
    }
    return Response.json({ error: "Failed to fetch delivery data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_delivery_post", limit: 60, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const body =
      rawBody.mode === "add_partner" ? addPartnerSchema.parse(rawBody) : assignOrderSchema.parse(rawBody);

    if (body.mode === "add_partner") {
      const ref = adminDb.collection("staff").doc();
      await ref.set({
        id: ref.id,
        userId: ref.id,
        branchId: "hyderabad-main",
        name: body.name,
        phone: body.phone ?? "",
        role: "delivery_boy",
        online: false,
        activeOrders: 0,
        active: true,
        performanceScore: 80
      });
      return Response.json({ success: true, id: ref.id }, { status: 201 });
    }

    const assignmentRef = adminDb.collection("delivery_assignments").doc();
    const now = new Date().toISOString();
    await assignmentRef.set({
      id: assignmentRef.id,
      orderId: body.orderId,
      deliveryBoyId: body.deliveryPartnerId,
      status: "assigned",
      assignedAt: now,
      updatedAt: now
    });
    await adminDb.collection("orders").doc(body.orderId).set(
      {
        deliveryPartnerId: body.deliveryPartnerId,
        updatedAt: now
      },
      { merge: true }
    );
    return Response.json({ success: true, id: assignmentRef.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Delivery POST error:", error);
    }
    return Response.json({ error: "Failed to process delivery request." }, { status: 500 });
  }
}
