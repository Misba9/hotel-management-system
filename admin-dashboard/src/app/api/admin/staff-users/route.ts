import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { StaffEmailUnavailableError, assertStaffEmailAvailable } from "@/lib/server/assertStaffEmailAvailable";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import {
  type StaffManagementRoleId,
  staffManagementRoleToAuthClaim,
  staffManagementRoleToUsersField
} from "../../../../../../shared/constants/staff-management-roles";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const staffManagementRoleSchema = z.enum(["admin", "manager", "cashier", "kitchen", "delivery", "waiter"]);

const createBody = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: staffManagementRoleSchema,
  isActive: z.boolean()
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_users_post", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const body = createBody.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    try {
      await assertStaffEmailAvailable(email);
    } catch (e) {
      if (e instanceof StaffEmailUnavailableError) {
        return Response.json({ error: e.message }, { status: 409, headers: NO_STORE });
      }
      throw e;
    }

    // 1) Firebase Auth first — obtain canonical uid for Firestore document id
    const userRecord = await adminAuth.createUser({
      email,
      password: body.password,
      displayName: body.name.trim(),
      disabled: !body.isActive
    });

    const uid = userRecord.uid;
    const claimRole = staffManagementRoleToAuthClaim(body.role as StaffManagementRoleId);

    try {
      await adminAuth.setCustomUserClaims(uid, { role: claimRole });

      // 2) staff_users/{uid} — MUST use doc(uid).set(...) / setDoc; NEVER addDoc (random ids)
      const staffUserPayload = {
        uid,
        email,
        role: body.role,
        isActive: body.isActive,
        name: body.name.trim(),
        pendingApproval: false,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: auth.user.uid,
        createdByEmail: auth.user.email
      };

      await adminDb.collection("staff_users").doc(uid).set(staffUserPayload);

      await adminDb.collection("users").doc(uid).set(
        {
          name: body.name.trim(),
          fullName: body.name.trim(),
          email,
          role: staffManagementRoleToUsersField(body.role as StaffManagementRoleId),
          isActive: body.isActive,
          status: body.isActive ? "active" : "inactive",
          approved: body.isActive,
          pendingApproval: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    } catch (inner) {
      try {
        await adminAuth.deleteUser(uid);
      } catch {
        // best-effort cleanup if Firestore/custom claims failed after Auth user was created
      }
      throw inner;
    }

    return Response.json({ success: true, uid }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400, headers: NO_STORE });
    }
    const code = (error as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "That email is already registered." }, { status: 409, headers: NO_STORE });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[staff-users POST]", error);
    }
    return Response.json({ error: "Failed to create staff user." }, { status: 500, headers: NO_STORE });
  }
}
