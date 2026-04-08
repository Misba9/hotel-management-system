"use client";

/**
 * Dev helper: print the signed-in Firebase Auth UID (use when filling `scripts/set-admin-role.ts`).
 *
 * Firebase v9 modular pattern (uses the dashboard’s named app):
 *
 * ```ts
 * const auth = getFirebaseAuth();
 * console.log(auth.currentUser?.uid);
 * ```
 */
import { getFirebaseAuth } from "./firebase";

export function logCurrentUserUid(): void {
  const auth = getFirebaseAuth();
  console.log(auth.currentUser?.uid);
}
