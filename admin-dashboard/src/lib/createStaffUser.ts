import { adminApiFetch } from "@/shared/lib/admin-api";
import { getStaffCreatePostUrl } from "@/lib/staff-create-endpoint";
import type { StaffAppPlatform } from "../../../shared/constants/staff-app-access";
import type { StaffManagementRoleId } from "../../../shared/constants/staff-management-roles";

/** Roles allowed when provisioning staff (matches Firestore `staff_users.role`). */
export type CreateStaffRole = StaffManagementRoleId;

export type CreateStaffUserInput = {
  name: string;
  email: string;
  password: string;
  role: CreateStaffRole;
  /** Defaults to true — new staff can sign in immediately. */
  isActive?: boolean;
  /** Which apps this user may sign in to (defaults from role). */
  allowedApps?: StaffAppPlatform[];
};

/**
 * Admin-only: creates Firebase Auth user, then `staff_users/{uid}` with the same UID (document id === Auth UID).
 * The server runs a duplicate-email preflight (Auth + `staff_users`) before creation; conflicts return HTTP 409.
 * Uses Next.js API or Cloud Function URL from `NEXT_PUBLIC_FIREBASE_CREATE_STAFF_URL`.
 */
export async function createStaffUser(input: CreateStaffUserInput): Promise<{ uid: string }> {
  const res = await adminApiFetch(getStaffCreatePostUrl(), {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      role: input.role,
      isActive: input.isActive !== false,
      ...(input.allowedApps ? { allowedApps: input.allowedApps } : {})
    })
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? "Failed to create staff user.");
  }
  const data = (await res.json()) as { uid: string };
  return { uid: data.uid };
}
