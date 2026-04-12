import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import {
  type StaffManagementRoleId,
  staffManagementRoleToAuthClaim,
  staffManagementRoleToUsersField
} from "../../../../../../../shared/constants/staff-management-roles";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const staffManagementRoleSchema = z.enum(["admin", "manager", "cashier", "kitchen", "delivery"]);

const patchBody = z
  .object({
    role: staffManagementRoleSchema.optional(),
    isActive: z.boolean().optional(),
    name: z.string().min(2).max(120).optional()
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined || v.name !== undefined, {
    message: "Nothing to update."
  });

export async function PATCH(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_users_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { uid } = context.params;
    if (!uid) {
      return Response.json({ error: "Missing uid." }, { status: 400, headers: NO_STORE });
    }

    const body = patchBody.parse(await request.json());

    const ref = adminDb.collection("staff_users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ error: "Staff user not found." }, { status: 404, headers: NO_STORE });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      updates.name = trimmed;
      await adminAuth.updateUser(uid, { displayName: trimmed });
      await adminDb.collection("users").doc(uid).set(
        {
          name: trimmed,
          fullName: trimmed,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    if (body.role !== undefined) {
      updates.role = body.role;
      await adminAuth.setCustomUserClaims(uid, {
        role: staffManagementRoleToAuthClaim(body.role as StaffManagementRoleId)
      });
      await adminDb.collection("users").doc(uid).set(
        {
          role: staffManagementRoleToUsersField(body.role as StaffManagementRoleId),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    if (body.isActive !== undefined) {
      updates.isActive = body.isActive;
      await adminAuth.updateUser(uid, { disabled: !body.isActive });
      await adminDb.collection("users").doc(uid).set(
        {
          isActive: body.isActive,
          status: body.isActive ? "active" : "inactive",
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    if (body.isActive === true || body.role !== undefined) {
      updates.pendingApproval = false;
    }

    await ref.set(updates, { merge: true });

    return Response.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400, headers: NO_STORE });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-users PATCH]", error);
    }
    return Response.json({ error: "Failed to update staff user." }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_users_delete", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const { uid } = context.params;
    if (!uid) {
      return Response.json({ error: "Missing uid." }, { status: 400, headers: NO_STORE });
    }

    if (uid === auth.user.uid) {
      return Response.json({ error: "You cannot delete your own account." }, { status: 400, headers: NO_STORE });
    }

    const ref = adminDb.collection("staff_users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ error: "Staff user not found." }, { status: 404, headers: NO_STORE });
    }

    await ref.delete();
    await adminDb.collection("users").doc(uid).delete().catch(() => undefined);

    try {
      await adminAuth.deleteUser(uid);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/user-not-found" && process.env.NODE_ENV !== "production") {
        console.error("[staff-users DELETE] auth delete:", e);
      }
    }

    return Response.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-users DELETE]", error);
    }
    return Response.json({ error: "Failed to delete staff user." }, { status: 500, headers: NO_STORE });
  }
}
