import type { User } from "firebase/auth";
import { createUserIfNotExists, mergeUserLoginStamp } from "@/lib/user-service";

/**
 * Ensures `users/{uid}` exists and records `lastLoginAt`.
 * Profile data for UI is loaded via `UserProfileProvider` / `loadUserProfileForSession`.
 */
export async function syncUserToFirestore(user: User): Promise<void> {
  await createUserIfNotExists(user);
  await mergeUserLoginStamp(user);
}

/** @deprecated Use syncUserToFirestore */
export async function syncGoogleUserToFirestore(user: User): Promise<void> {
  return syncUserToFirestore(user);
}
