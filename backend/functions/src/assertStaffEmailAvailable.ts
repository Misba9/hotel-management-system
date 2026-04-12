import { auth, db } from "./v1/common";

export class StaffEmailUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffEmailUnavailableError";
  }
}

export async function assertStaffEmailAvailable(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  try {
    await auth.getUserByEmail(normalized);
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

  const dup = await db.collection("staff_users").where("email", "==", normalized).limit(1).get();
  if (!dup.empty) {
    throw new StaffEmailUnavailableError("That email is already in the staff directory.");
  }
}
