import { doc, getDoc, onSnapshot } from "firebase/firestore";
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

function mapFirestoreError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (code.includes("failed-precondition")) {
    return "Firestore index required for this query. Create the suggested index in Firebase Console.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Failed to load profile from Firestore.";
}

/**
 * One-shot read after Firebase Auth sign-in (matches login flow spec: `getDoc` by UID).
 */
export async function fetchStaffProfileAfterAuth(user: User): Promise<StaffProfileLoadResult> {
  try {
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
  } catch (error) {
    return { ok: false, reason: mapFirestoreError(error) };
  }
}

export function subscribeStaffProfile(
  user: User,
  onChange: (result: StaffProfileLoadResult) => void,
  onError?: (message: string) => void
): () => void {
  const ref = doc(staffDb, STAFF_USERS_COLLECTION, user.uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange({
          ok: false,
          reason: "No staff profile found. Ask an admin to create your document in Firestore (staff_users / staffUsers)."
        });
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const { gate, profile } = resolveStaffSession(user.uid, user.email, data, true);
      if (gate === "active" && profile) {
        onChange({ ok: true, profile });
        return;
      }
      if (gate === "pending") {
        onChange({ ok: false, reason: "Your account is pending approval or role assignment." });
        return;
      }
      if (gate === "needs_assignment") {
        onChange({ ok: false, reason: "Your role is not assigned yet. Contact an administrator." });
        return;
      }
      if (gate === "paused") {
        onChange({ ok: false, reason: "This staff account is inactive." });
        return;
      }
      onChange({ ok: false, reason: "Unable to activate staff session from Firestore." });
    },
    (error) => {
      onError?.(mapFirestoreError(error));
    }
  );
}
