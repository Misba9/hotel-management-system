/**
 * Firebase Authentication helpers for the staff app (email/password).
 * After sign-in, ensures `staff_users/{uid}` exists (auto-create if missing) before returning.
 */
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ensureStaffProfileAfterLogin } from "./staffUsers";
import { staffAuth as auth } from "../lib/firebase";

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  await cred.user.getIdToken(true);
  await ensureStaffProfileAfterLogin(cred.user);
  return cred.user;
}

export function logout() {
  return signOut(auth);
}
