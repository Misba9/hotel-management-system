/**
 * Firebase Authentication helpers for the staff app (email/password).
 * Staff profile hydration runs once in `useAuthStore` after auth state changes.
 */
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { staffAuth as auth } from "../lib/firebase";

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
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.error("[staffAuth.login]", error);
    }
    throw error;
  }
}

export function logout() {
  return signOut(auth);
}
