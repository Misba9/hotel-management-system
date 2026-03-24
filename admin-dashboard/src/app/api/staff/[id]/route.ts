import { adminDb } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

const updateStaffSchema = z
  .object({
    role: z.enum(["delivery_boy", "kitchen_staff", "waiter", "cashier", "manager", "admin"]).optional(),
    performanceScore: z.number().int().min(0).max(100).optional(),
    active: z.boolean().optional(),
    online: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const secure = await enforceApiSecurity(request, {
    roles: ["admin"],
    rateLimit: { keyPrefix: "admin_staff_patch", limit: 60, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;
  try {
    const id = context.params.id;
    const body = updateStaffSchema.parse(await request.json());
    await adminDb.collection("staff").doc(id).set(body, { merge: true });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    console.error("Staff PATCH error:", error);
    return Response.json({ error: "Failed to update staff." }, { status: 500 });
  }
}
