/**
 * Firebase Authentication helpers for the staff app (email/password).
 * Staff profile hydration runs once in `useAuthStore` after auth state changes.
 */
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { staffAuth as auth } from "../lib/firebase";

/** User-facing auth failures — do not escalate to LogBox via console.error. */
const EXPECTED_LOGIN_CODES = new Set([
  "auth/invalid-email",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/network-request-failed",
  "auth/too-many-requests",
  "auth/missing-password",
  "auth/missing-email"
]);

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function login(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
    return cred.user;
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : "";
    const expected = EXPECTED_LOGIN_CODES.has(code);
    if (typeof __DEV__ !== "undefined" && __DEV__ && !expected) {
      // eslint-disable-next-line no-console
      console.error("[staffAuth.login]", error);
    }
    throw error;
  }
}

export function logout() {
  return signOut(auth);
}
