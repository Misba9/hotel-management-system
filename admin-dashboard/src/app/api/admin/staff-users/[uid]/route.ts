import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import { defaultAppsForRole } from "../../../../../../../shared/constants/staff-app-access";
import {
  type StaffManagementRoleId,
  staffManagementRoleToAuthClaim,
  staffManagementRoleToUsersField
} from "../../../../../../../shared/constants/staff-management-roles";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const staffManagementRoleSchema = z.enum(["admin", "manager", "cashier", "kitchen", "waiter"]);
const allowedAppsSchema = z.array(z.enum(["desktop", "mobile"])).min(1).max(2);

const patchBody = z
  .object({
    role: staffManagementRoleSchema.optional(),
    isActive: z.boolean().optional(),
    name: z.string().min(2).max(120).optional(),
    newPassword: z.string().min(6).max(128).optional(),
    allowedApps: allowedAppsSchema.optional()
  })
  .refine(
    (v) =>
      v.role !== undefined ||
      v.isActive !== undefined ||
      v.name !== undefined ||
      v.newPassword !== undefined ||
      v.allowedApps !== undefined,
    { message: "Nothing to update." }
  );

export async function PATCH(request: Request, context: { params: { uid: string } }) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_users_patch", limit: 60, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const uid = context.params.uid?.trim();
    if (!uid) {
      return Response.json({ error: "Missing uid." }, { status: 400, headers: NO_STORE });
    }

    const body = patchBody.parse(await request.json());

    const ref = adminDb.collection("staff_users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ error: "Staff user not found." }, { status: 404, headers: NO_STORE });
    }

    const prevStaff = snap.data() as { isActive?: boolean };
    const staffWasActive = prevStaff.isActive !== false;
    const effectiveActive = body.isActive !== undefined ? body.isActive : staffWasActive;

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
      if (body.allowedApps === undefined) {
        updates.allowedApps = defaultAppsForRole(body.role as StaffManagementRoleId);
      }
      await adminAuth.setCustomUserClaims(uid, {
        role: staffManagementRoleToAuthClaim(body.role as StaffManagementRoleId)
      });
      await adminDb.collection("users").doc(uid).set(
        {
          role: staffManagementRoleToUsersField(body.role as StaffManagementRoleId),
          pendingApproval: false,
          ...(effectiveActive ? { approved: true } : {}),
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
          approved: body.isActive,
          pendingApproval: false,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    if (body.isActive === true || body.role !== undefined) {
      updates.pendingApproval = false;
    }

    if (body.allowedApps !== undefined) {
      updates.allowedApps = body.allowedApps;
    }

    if (body.newPassword !== undefined) {
      await adminAuth.updateUser(uid, { password: body.newPassword });
    }

    if (Object.keys(updates).length > 1) {
      await ref.set(updates, { merge: true });
    }

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
    const uid = context.params.uid?.trim();
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

    // Delete the Auth account first: if this fails we abort before touching Firestore,
    // so we never leave an orphaned Auth account that blocks re-adding the same email.
    try {
      await adminAuth.deleteUser(uid);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        if (process.env.NODE_ENV !== "production") {
          console.error("[staff-users DELETE] auth delete:", e);
        }
        return Response.json(
          { error: "Failed to delete the authentication account. Please try again." },
          { status: 500, headers: NO_STORE }
        );
      }
    }

    await ref.delete();
    await adminDb.collection("users").doc(uid).delete().catch(() => undefined);

    return Response.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-users DELETE]", error);
    }
    return Response.json({ error: "Failed to delete staff user." }, { status: 500, headers: NO_STORE });
  }
}
