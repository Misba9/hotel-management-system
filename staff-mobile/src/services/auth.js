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
  const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  await cred.user.getIdToken(true);
  return cred.user;
}

export function logout() {
  return signOut(auth);
}
