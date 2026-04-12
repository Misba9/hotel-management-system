import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@shared/firebase/admin";
import { requireAdmin } from "@shared/utils/admin-api-auth";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type StaffRoleId,
  staffRoleToAuthClaim,
  staffRoleToUsersCollectionRole
} from "../../../../../../shared/constants/staff-roles";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const createBody = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["manager", "waiter", "kitchen"]),
  phone: z.string().min(5).max(32)
});

async function seedRolesPermissionsIfNeeded() {
  const batch = adminDb.batch();
  let any = false;
  for (const role of ["manager", "waiter", "kitchen"] as StaffRoleId[]) {
    const ref = adminDb.collection("roles_permissions").doc(role);
    const snap = await ref.get();
    if (!snap.exists) {
      any = true;
      batch.set(ref, {
        role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role],
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }
  if (any) await batch.commit();
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_staff_accounts_post", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const body = createBody.parse(await request.json());
    await seedRolesPermissionsIfNeeded();

    const userRecord = await adminAuth.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      displayName: body.name.trim()
    });

    const uid = userRecord.uid;
    const claimRole = staffRoleToAuthClaim(body.role);

    await adminAuth.setCustomUserClaims(uid, { role: claimRole });

    const staffPayload = {
      uid,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      role: body.role,
      phone: body.phone.trim(),
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    };

    await adminDb.collection("staff").doc(uid).set(staffPayload);

    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          name: body.name.trim(),
          fullName: body.name.trim(),
          email: body.email.trim().toLowerCase(),
          role: staffRoleToUsersCollectionRole(body.role),
          isActive: true,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

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
      console.error("[staff-accounts POST]", error);
    }
    return Response.json({ error: "Failed to create staff account." }, { status: 500, headers: NO_STORE });
  }
}
