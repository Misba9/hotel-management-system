/**
 * Synchronous Firestore/Auth bridge for ported mobile services.
 * Call `initStaffDb()` once at app startup before using requireStaffDb().
 */
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { getStaffDesktopAuth, getStaffDesktopFirestore } from "./firebase";

export let staffDb!: Firestore;
export let staffAuth!: Auth;

/** Alias used by billingQuery and legacy mobile imports. */
export const firestoreDb = staffDb;

let initPromise: Promise<void> | null = null;

export async function initStaffDb(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = await getStaffDesktopFirestore();
    const auth = await getStaffDesktopAuth();
    if (!db || !auth) throw new Error("Firebase is not configured.");
    staffDb = db;
    staffAuth = auth;
  })();
  return initPromise;
}

export function requireStaffDb(): Firestore {
  if (!staffDb) throw new Error("Staff Firestore not initialized — call initStaffDb() first.");
  return staffDb;
}

export function requireStaffAuth(): Auth {
  if (!staffAuth) throw new Error("Staff Auth not initialized — call initStaffDb() first.");
  return staffAuth;
}

export function getStaffDbOrNull(): Firestore | null {
  return staffDb ?? null;
}
