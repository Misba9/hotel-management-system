import { adminAuth, adminDb } from "@shared/firebase/admin";

/**
 * Thrown when the email is already used in Firebase Auth or appears in `staff_users`.
 */
export class StaffEmailUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffEmailUnavailableError";
  }
}

/**
 * Preflight before `createUser`: ensures no Auth account and no `staff_users` row with this email.
 * Auth UID for new staff will still be `staff_users/{uid}` (document id === uid).
 */
export async function assertStaffEmailAvailable(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  try {
    await adminAuth.getUserByEmail(normalized);
    throw new StaffEmailUnavailableError("That email is already registered.");
  } catch (e: unknown) {
    if (e instanceof StaffEmailUnavailableError) throw e;
    const code = (e as { code?: string }).code;
    if (code === "auth/user-not-found") {
      /* proceed */
    } else {
      throw e;
    }
  }

  const dup = await adminDb.collection("staff_users").where("email", "==", normalized).limit(1).get();
  if (!dup.empty) {
    throw new StaffEmailUnavailableError("That email is already in the staff directory.");
  }
}
