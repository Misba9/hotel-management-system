import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { staffRoleToAuthClaim, staffRoleToUsersCollectionRole } from "../../../../../../../shared/constants/staff-roles";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const patchBody = z
  .object({
    role: z.enum(["manager", "waiter", "kitchen"]).optional(),
    isActive: z.boolean().optional()
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, { message: "Nothing to update." });

export async function PATCH(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_accounts_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { uid } = context.params;
    if (!uid) {
      return Response.json({ error: "Missing uid." }, { status: 400, headers: NO_STORE });
    }

    const body = patchBody.parse(await request.json());

    const staffRef = adminDb.collection("staff").doc(uid);
    const snap = await staffRef.get();
    if (!snap.exists) {
      return Response.json({ error: "Staff record not found." }, { status: 404, headers: NO_STORE });
    }

    const updates: Record<string, unknown> = {};
    if (body.role !== undefined) {
      updates.role = body.role;
      await adminAuth.setCustomUserClaims(uid, { role: staffRoleToAuthClaim(body.role) });
      await adminDb.collection("users").doc(uid).set(
        { role: staffRoleToUsersCollectionRole(body.role), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    if (body.isActive !== undefined) {
      updates.isActive = body.isActive;
      await adminAuth.updateUser(uid, { disabled: !body.isActive });
      await adminDb.collection("users").doc(uid).set(
        { isActive: body.isActive, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    await staffRef.set(updates, { merge: true });

    return Response.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400, headers: NO_STORE });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-accounts PATCH]", error);
    }
    return Response.json({ error: "Failed to update staff." }, { status: 500, headers: NO_STORE });
  }
}
