import type { User } from "firebase/auth";
import { mirrorUserAddressesToCustomerDoc, upsertCustomerOnLogin } from "@/lib/customer-doc-sync";
import { ensureFirestoreOnline, isOfflineLikeFirestoreError, logFirebaseDiagnostics } from "@/lib/firebase";
import { createUserIfNotExists, mergeUserLoginStamp } from "@/lib/user-service";

/**
 * Ensures `users/{uid}` exists, records `lastLoginAt`, mirrors to `customers/{uid}` for admin sync.
 * Profile for UI is loaded via `UserProfileProvider` (real-time `users/{uid}` listener).
 *
 * Never throws for transient Firestore offline — Auth already succeeded; profile sync can catch up.
 */
export async function syncUserToFirestore(user: User): Promise<void> {
  try {
    await ensureFirestoreOnline();
    await createUserIfNotExists(user);
    await mergeUserLoginStamp(user);
    await upsertCustomerOnLogin(user);
    await mirrorUserAddressesToCustomerDoc(user.uid);
  } catch (error) {
    logFirebaseDiagnostics("syncUserToFirestore failed (non-fatal for login)", {
      uid: user.uid,
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "(none)",
      message: error instanceof Error ? error.message : String(error),
      offlineLike: isOfflineLikeFirestoreError(error)
    });
    // Do not rethrow — phone/Google/email sign-in must succeed even if profile write is delayed.
  }
}

/** @deprecated Use syncUserToFirestore */
export async function syncGoogleUserToFirestore(user: User): Promise<void> {
  return syncUserToFirestore(user);
}
