import type { User } from "firebase/auth";
import { mirrorUserAddressesToCustomerDoc, upsertCustomerOnLogin } from "@/lib/customer-doc-sync";
import { createUserIfNotExists, mergeUserLoginStamp } from "@/lib/user-service";

/**
 * Ensures `users/{uid}` exists, records `lastLoginAt`, mirrors to `customers/{uid}` for admin sync.
 * Profile for UI is loaded via `UserProfileProvider` (real-time `users/{uid}` listener).
 */
export async function syncUserToFirestore(user: User): Promise<void> {
  await createUserIfNotExists(user);
  await mergeUserLoginStamp(user);
  await upsertCustomerOnLogin(user);
  await mirrorUserAddressesToCustomerDoc(user.uid);
}

/** @deprecated Use syncUserToFirestore */
export async function syncGoogleUserToFirestore(user: User): Promise<void> {
  return syncUserToFirestore(user);
}
