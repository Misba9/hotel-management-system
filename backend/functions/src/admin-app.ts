import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

/**
 * Initialize Admin SDK once at module load.
 * Every functions module must import `db`/`auth`/`messaging` from here
 * (not call getFirestore() at top-level before initializeApp).
 */
function getOrInitApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp();
}

export const adminApp: App = getOrInitApp();
export const db: Firestore = getFirestore(adminApp);
export const auth: Auth = getAuth(adminApp);
export const messaging: Messaging = getMessaging(adminApp);
