import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { StaffRoleId } from "../constants/staff-roles";
import { STAFF_ROLE_IDS } from "../constants/staff-roles";
import { staffDb } from "../lib/firebase";
import { STAFF_USERS_COLLECTION } from "../navigation/staff-role-routes";

export type StaffProfile = {
  uid: string;
  email: string;
  name: string;
  role: StaffRoleId;
};

function normalizeRole(raw: unknown): StaffRoleId | "pending" | null {
  if (typeof raw !== "string") return null;
  const r = raw.trim().toLowerCase();
  if (r === "pending") return "pending";
  if (STAFF_ROLE_IDS.includes(r as StaffRoleId)) return r as StaffRoleId;
  if (r === "kitchen_staff") return "kitchen";
  if (r === "delivery_boy") return "delivery";
  return null;
}

function isActive(data: Record<string, unknown>): boolean {
  return data.isActive === true;
}

export function isPendingRole(data: Record<string, unknown>): boolean {
  return normalizeRole(data.role) === "pending";
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

  // eslint-disable-next-line no-console
  console.log("UID:", uid);
  // eslint-disable-next-line no-console
  console.log("Firestore path:", `${STAFF_USERS_COLLECTION}/${uid}`);

  let snap = await getDoc(ref);
  // eslint-disable-next-line no-console
  console.log("Doc exists:", snap.exists());

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
  // eslint-disable-next-line no-console
  console.log("Doc exists after create:", snap.exists());

  if (!snap.exists()) {
    throw new Error("Could not create staff profile.");
  }

  // eslint-disable-next-line no-console
  console.log("User data:", snap.data());
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

  const roleNorm = normalizeRole(data.role);
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
    role: roleNorm
  };

  return { gate: "active", profile };
}

const USERS_COLLECTION = "users" as const;
export { USERS_COLLECTION };

/**
 * Prefer `users/{uid}.role` for navigation/RBAC when set and valid; otherwise keep `staff_users` role.
 * Does not change approval gates (pending/paused) — only the active {@link StaffProfile.role}.
 */
export function mergeNavigationRoleFromUsersDoc(
  profile: StaffProfile,
  usersData: Record<string, unknown> | null | undefined
): StaffProfile {
  if (!usersData || typeof usersData.role !== "string") return profile;
  const fromUsers = normalizeRole(usersData.role);
  if (fromUsers === null || fromUsers === "pending") return profile;
  return { ...profile, role: fromUsers };
}
