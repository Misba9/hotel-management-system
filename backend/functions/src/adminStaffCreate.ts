import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { StaffEmailUnavailableError, assertStaffEmailAvailable } from "./assertStaffEmailAvailable";
import { authenticateHttp, auth, db } from "./v1/common";

const staffRoleSchema = z.enum(["admin", "manager", "cashier", "kitchen", "delivery", "waiter"]);

const createStaffBodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: staffRoleSchema,
  isActive: z.boolean().optional().default(true)
});

type StaffMgmtRole = z.infer<typeof staffRoleSchema>;

function staffManagementRoleToAuthClaim(role: StaffMgmtRole): string {
  switch (role) {
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "cashier":
      return "cashier";
    case "kitchen":
      return "kitchen_staff";
    case "delivery":
      return "delivery_boy";
    case "waiter":
      return "waiter";
    default:
      return "cashier";
  }
}

function mapHttpsError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof HttpsError) {
    const code = err.code;
    const status =
      code === "invalid-argument"
        ? 400
        : code === "unauthenticated"
          ? 401
          : code === "permission-denied"
            ? 403
            : code === "not-found"
              ? 404
              : code === "already-exists"
                ? 409
                : code === "resource-exhausted"
                  ? 429
                  : 500;
    return { status, body: { success: false, error: err.message } };
  }
  return { status: 500, body: { success: false, error: "Internal server error." } };
}

/**
 * Admin-only staff provisioning (Auth UID == `staff_users` document id).
 *
 * Flow: verify ID token → require custom claim `role === "admin"` → `auth.createUser` →
 * `setCustomUserClaims` (maps management role to Auth claim) → `staff_users/{uid}.set` → `users/{uid}` merge.
 * Rollback: deletes Auth user if Firestore/claims fail after user creation.
 *
 * Security: HTTP invoker may be public (browser/CORS); **authorization is mandatory** via
 * `Authorization: Bearer <Firebase ID token>` — unauthenticated requests receive 401.
 *
 * Deploy: `firebase deploy --only functions:createStaffUser`
 * URL: `https://<region>-<project>.cloudfunctions.net/createStaffUser`
 */
export const createStaffUser = onRequest(
  { cors: true, invoker: "public", maxInstances: 10 },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed" });
      return;
    }

    try {
      const identity = await authenticateHttp(req);
      if (identity.role !== "admin") {
        throw new HttpsError("permission-denied", "Admin role required");
      }

      const body = createStaffBodySchema.parse(req.body);
      const email = body.email.trim().toLowerCase();
      const claimRole = staffManagementRoleToAuthClaim(body.role);

      try {
        await assertStaffEmailAvailable(email);
      } catch (e) {
        if (e instanceof StaffEmailUnavailableError) {
          res.status(409).json({ success: false, error: e.message });
          return;
        }
        throw e;
      }

      const userRecord = await auth.createUser({
        email,
        password: body.password,
        displayName: body.name.trim(),
        disabled: !body.isActive
      });

      const uid = userRecord.uid;

      try {
        await auth.setCustomUserClaims(uid, { role: claimRole });

        await db.collection("staff_users").doc(uid).set({
          uid,
          email,
          role: body.role,
          isActive: body.isActive,
          name: body.name.trim(),
          pendingApproval: false,
          createdAt: FieldValue.serverTimestamp(),
          createdByUid: identity.uid,
          createdByEmail: (await auth.getUser(identity.uid)).email ?? null
        });

        await db.collection("users").doc(uid).set(
          {
            name: body.name.trim(),
            fullName: body.name.trim(),
            email,
            role: claimRole,
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
          await auth.deleteUser(uid);
        } catch {
          /* ignore */
        }
        throw inner;
      }

      res.status(201).json({ success: true, uid });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: "Invalid payload.", details: error.issues });
        return;
      }
      const code = (error as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        res.status(409).json({ success: false, error: "That email is already registered." });
        return;
      }
      const mapped = mapHttpsError(error);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[createStaffUser]", error);
      }
      res.status(mapped.status).json(mapped.body);
    }
  }
);
