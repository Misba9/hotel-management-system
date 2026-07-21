import { auth, db } from "./v1/common";

export class StaffEmailUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffEmailUnavailableError";
  }
}

/**
 * Self-healing: an Auth account with no `staff_users` and no `users` doc is an orphan
 * (leftover from a partial delete) and is removed so the email can be reused.
 */
export async function assertStaffEmailAvailable(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  let existingUid: string | null = null;
  try {
    const existing = await auth.getUserByEmail(normalized);
    existingUid = existing.uid;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "auth/user-not-found") throw e;
  }

  if (existingUid) {
    const [staffDoc, usersDoc] = await Promise.all([
      db.collection("staff_users").doc(existingUid).get(),
      db.collection("users").doc(existingUid).get()
    ]);
    if (staffDoc.exists || usersDoc.exists) {
      throw new StaffEmailUnavailableError("That email is already registered.");
    }
    await auth.deleteUser(existingUid);
  }

  const dup = await db.collection("staff_users").where("email", "==", normalized).limit(1).get();
  if (!dup.empty) {
    throw new StaffEmailUnavailableError("That email is already in the staff directory.");
  }
}
