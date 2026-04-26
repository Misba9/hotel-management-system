import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  normalizeStaffAppRole,
  normalizeStaffUsersRowRole,
  usersDocBlocksStaffAccess
} from "@shared/utils/staff-access-control";
import type { StaffRoleId } from "../constants/staff-roles";
import { staffDb } from "../lib/firebase";
import { STAFF_USERS_COLLECTION } from "../navigation/staff-role-routes";

export type StaffProfile = {
  uid: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: StaffRoleId;
};

function isActive(data: Record<string, unknown>): boolean {
  return data.isActive === true;
}

export function isPendingRole(data: Record<string, unknown>): boolean {
  return normalizeStaffUsersRowRole(data.role) === "pending";
}

export async function getStaffUser(uid: string): Promise<Record<string, unknown> | null> {
  const ref = doc(staffDb, STAFF_USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function getStaffProfile(uid: string): Promise<{
  exists: boolean;
  role: string;
  isActive: boolean;
  data: Record<string, unknown> | null;
}> {
  const data = await getStaffUser(uid);
  if (!data) {
    return { exists: false, role: "", isActive: false, data: null };
  }
  return {
    exists: true,
    role: typeof data.role === "string" ? data.role : "",
    isActive: data.isActive === true,
    data
  };
}

/**
 * Ensures `staff_users/{uid}` exists. Document id === Auth UID.
 * Schema: uid, email, role, isActive, createdAt
 */
export async function ensureStaffProfileDocument(uid: string, email: string | null): Promise<void> {
  const ref = doc(staffDb, STAFF_USERS_COLLECTION, uid);

  let snap = await getDoc(ref);

  if (snap.exists()) return;

  const safeEmail = (email ?? "").trim();

  await setDoc(ref, {
    uid,
    email: safeEmail,
    role: "pending",
    isActive: true,
    createdAt: serverTimestamp()
  });

  snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Could not create staff profile.");
  }
}

export async function ensurePendingStaffProfile(uid: string, email: string | null, _displayName: string | null) {
  return ensureStaffProfileDocument(uid, email);
}

export async function ensureStaffProfileAfterLogin(user: User): Promise<void> {
  return ensureStaffProfileDocument(user.uid, user.email);
}

export type StaffSessionGate =
  | "loading"
  | "pending"
  | "active"
  /** Assigned role but not active */
  | "paused"
  /** Role string not recognized — wait for admin */
  | "needs_assignment";

/**
 * Maps Firestore data → navigation gate. Never returns "access denied" — unknowns go to needs_assignment or pending.
 */
export function resolveStaffSession(
  uid: string,
  authEmail: string | null,
  data: Record<string, unknown> | undefined,
  exists: boolean
): { gate: StaffSessionGate; profile: StaffProfile | null } {
  if (!exists || !data) {
    return { gate: "loading", profile: null };
  }

  const roleNorm = normalizeStaffUsersRowRole(data.role);
  const rawRole = typeof data.role === "string" ? data.role.trim() : "";

  if (roleNorm === "pending") {
    return { gate: "pending", profile: null };
  }

  if (roleNorm === null) {
    if (rawRole.length > 0) {
      return { gate: "needs_assignment", profile: null };
    }
    return { gate: "pending", profile: null };
  }

  if (!isActive(data)) {
    return { gate: "paused", profile: null };
  }

  const email =
    typeof data.email === "string" && data.email.trim() ? data.email.trim() : authEmail ?? "";
  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : email.includes("@")
        ? email.split("@")[0]
        : email || "Staff";

  const profile: StaffProfile = {
    uid,
    email,
    name,
    phoneNumber:
      typeof data.phoneNumber === "string" && data.phoneNumber.trim()
        ? data.phoneNumber.trim()
        : typeof data.phone === "string" && data.phone.trim()
          ? data.phone.trim()
          : "",
    role: roleNorm
  };

  return { gate: "active", profile };
}

const USERS_COLLECTION = "users" as const;
export { USERS_COLLECTION };

/**
 * Normalized role from `users/{uid}.role` for staff RBAC (null if missing or not assignable).
 */
export function parseStaffRoleFromUsersDocument(
  usersData: Record<string, unknown> | null | undefined
): StaffRoleId | null {
  if (!usersData || typeof usersData.role !== "string") return null;
  const n = normalizeStaffUsersRowRole(usersData.role);
  if (n === "pending" || n === null) return null;
  return n;
}

/**
 * `true` / `false` when the document states approval explicitly; `null` when no doc or legacy (no `approved` flag).
 */
export function parseUsersDocApproved(usersData: Record<string, unknown> | null | undefined): boolean | null {
  if (usersData == null) return null;
  if (usersData.approved === true) return true;
  if (usersData.approved === false) return false;
  if (usersData.pendingApproval === true) return false;
  return null;
}

/**
 * When `users/{uid}` exists and says not approved, the staff app should stay on the pending-approval experience.
 * Missing document does not block (legacy accounts with only `staff_users`).
 */
export function isUsersProfileBlockingStaffApp(usersData: Record<string, unknown> | null | undefined): boolean {
  return usersDocBlocksStaffAccess(usersData ?? undefined);
}

export type PendingApprovalReason = "staff_profile" | "users_doc";

/**
 * Prefer `users/{uid}.role` for navigation/RBAC when set and valid; otherwise keep `staff_users` role.
 * Does not change approval gates (pending/paused) — only the active {@link StaffProfile.role}.
 */
export function mergeNavigationRoleFromUsersDoc(
  profile: StaffProfile,
  usersData: Record<string, unknown> | null | undefined
): StaffProfile {
  if (!usersData || typeof usersData.role !== "string") return profile;
  const fromUsers = normalizeStaffAppRole(usersData.role);
  if (fromUsers === null) return profile;
  return { ...profile, role: fromUsers };
}
