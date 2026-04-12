import { adminApiFetch } from "@/shared/lib/admin-api";
import { getStaffCreatePostUrl } from "@/lib/staff-create-endpoint";

/** Roles allowed when provisioning staff (matches Firestore `staff_users.role`). */
export type CreateStaffRole = "admin" | "manager" | "cashier" | "kitchen" | "delivery";

export type CreateStaffUserInput = {
  name: string;
  email: string;
  password: string;
  role: CreateStaffRole;
  /** Defaults to true — new staff can sign in immediately. */
  isActive?: boolean;
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
      isActive: input.isActive !== false
    })
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? "Failed to create staff user.");
  }
  const data = (await res.json()) as { uid: string };
  return { uid: data.uid };
}
