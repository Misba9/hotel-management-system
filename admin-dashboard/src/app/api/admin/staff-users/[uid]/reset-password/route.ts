import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({
  newPassword: z.string().min(6).max(128)
});

export async function POST(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_users_reset_pw", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { uid } = context.params;
    if (!uid) {
      return Response.json({ error: "Missing uid." }, { status: 400, headers: NO_STORE });
    }

    const staffSnap = await adminDb.collection("staff_users").doc(uid).get();
    if (!staffSnap.exists) {
      return Response.json({ error: "Staff user not found." }, { status: 404, headers: NO_STORE });
    }

    const body = bodySchema.parse(await request.json());
    await adminAuth.updateUser(uid, { password: body.newPassword });

    return Response.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400, headers: NO_STORE });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-users reset-password]", error);
    }
    return Response.json({ error: "Failed to reset password." }, { status: 500, headers: NO_STORE });
  }
}
