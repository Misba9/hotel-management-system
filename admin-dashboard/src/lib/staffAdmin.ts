import { adminApiFetch } from "@/shared/lib/admin-api";
import { createStaffUser as postCreateStaffUser } from "./createStaffUser";
import type { CreateStaffRole, CreateStaffUserInput } from "./createStaffUser";

export type { CreateStaffRole, CreateStaffUserInput };

/**
 * Admin-only: creates Firebase Auth + `staff_users/{uid}` with **document id === Auth UID** (server-side Admin SDK).
 * Do not use client `createUserWithEmailAndPassword` for provisioning — it would switch the admin session.
 */
export const createStaffUser = postCreateStaffUser;

export async function updateStaffRole(uid: string, role: CreateStaffRole): Promise<void> {
  const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? "Failed to update role.");
  }
}

export async function toggleActive(uid: string, isActive: boolean): Promise<void> {
  const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? "Failed to update account status.");
  }
}
