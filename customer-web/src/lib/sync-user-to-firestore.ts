import type { User } from "firebase/auth";
import { mirrorUserAddressesToCustomerDoc, upsertCustomerOnLogin } from "@/lib/customer-doc-sync";
import {
  ensureFirestoreOnline,
  isFirestoreInternalAssertionError,
  isOfflineLikeFirestoreError,
  logFirebaseDiagnostics
} from "@/lib/firebase";
import { createUserIfNotExists } from "@/lib/user-service";

/**
 * Ensures `users/{uid}` exists, records `lastLoginAt`, mirrors to `customers/{uid}` for admin sync.
 * Profile for UI is loaded via `UserProfileProvider` (real-time `users/{uid}` listener).
 *
 * Login path is write-only (no cold getDoc) to avoid Firestore ca9/b815.
 * Address mirror is deferred so the profile listener can warm the WebChannel first.
 *
 * Never throws for transient Firestore offline — Auth already succeeded; profile sync can catch up.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncUserToFirestore(user: User): Promise<void> {
  try {
    await ensureFirestoreOnline();
    // Let UserProfileProvider attach a long-lived onSnapshot before any write/read
    // (firebase-js-sdk#9267 — cold getDoc as first op triggers ca9).
    await delay(350);
    // Single merge write (createUserIfNotExists already stamps lastLoginAt).
    await createUserIfNotExists(user);
    await upsertCustomerOnLogin(user);
    // Defer collection reads until after the profile listener has warmed the channel.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        void mirrorUserAddressesToCustomerDoc(user.uid).catch((error) => {
          logFirebaseDiagnostics("mirrorUserAddressesToCustomerDoc failed (non-fatal)", {
            uid: user.uid,
            message: error instanceof Error ? error.message : String(error),
            internalAssertion: isFirestoreInternalAssertionError(error)
          });
        });
      }, 1500);
    }
  } catch (error) {
    logFirebaseDiagnostics("syncUserToFirestore failed (non-fatal for login)", {
      uid: user.uid,
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "(none)",
      message: error instanceof Error ? error.message : String(error),
      offlineLike: isOfflineLikeFirestoreError(error),
      internalAssertion: isFirestoreInternalAssertionError(error)
    });
    // Do not rethrow — phone/Google/email sign-in must succeed even if profile write is delayed.
  }
}

/** @deprecated Use syncUserToFirestore */
export async function syncGoogleUserToFirestore(user: User): Promise<void> {
  return syncUserToFirestore(user);
}
