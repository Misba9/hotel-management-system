import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";

import type { StaffRoleId } from "../src/constants/staff-roles";
import { staffDb } from "../src/lib/firebase";
import { STAFF_USERS_COLLECTION } from "../src/navigation/staff-role-routes";
import { resolveStaffSession, type StaffProfile } from "../src/services/staffUsers";

/**
 * Staff directory in Firestore: **`staff_users`** (document id = Auth UID).
 * Product / API docs often call this collection **staffUsers** — same data.
 */
export type StaffProfileLoadResult =
  | { ok: true; profile: StaffProfile }
  | { ok: false; reason: string };

/**
 * One-shot read after Firebase Auth sign-in (matches login flow spec: `getDoc` by UID).
 */
export async function fetchStaffProfileAfterAuth(user: User): Promise<StaffProfileLoadResult> {
  const ref = doc(staffDb, STAFF_USERS_COLLECTION, user.uid);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) {
    return {
      ok: false,
      reason: "No staff profile found. Ask an admin to create your document in Firestore (staff_users / staffUsers)."
    };
  }
  const data = docSnap.data() as Record<string, unknown>;
  const { gate, profile } = resolveStaffSession(user.uid, user.email, data, true);

  if (gate === "active" && profile) {
    return { ok: true, profile };
  }
  if (gate === "pending") {
    return { ok: false, reason: "Your account is pending approval or role assignment." };
  }
  if (gate === "needs_assignment") {
    return { ok: false, reason: "Your role is not assigned yet. Contact an administrator." };
  }
  if (gate === "paused") {
    return { ok: false, reason: "This staff account is inactive." };
  }
  return { ok: false, reason: "Unable to activate staff session from Firestore." };
}
