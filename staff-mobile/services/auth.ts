import type { User } from "firebase/auth";

import { login as firebaseLogin, logout as firebaseLogout } from "../src/services/auth.js";

export type { User };

/** Email/password sign-in; ensures `staff_users/{uid}` via existing auth helper. */
export async function login(email: string, password: string): Promise<User> {
  return firebaseLogin(email, password);
}

export async function logout(): Promise<void> {
  return firebaseLogout();
}
