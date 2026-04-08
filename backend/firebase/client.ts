import { getApp, initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

/** True when required web client env vars are present (for UI hints). */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

/**
 * Single Firebase app: never call `initializeApp` twice for the default app.
 * Always check `getApps()` first (HMR, tests, or duplicate imports).
 */
function getOrCreateFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

const app: FirebaseApp = getOrCreateFirebaseApp();

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);

if (process.env.NODE_ENV === "development") {
  console.log("[firebase/client] Firestore db instance:", db);
}

export async function getClientMessaging() {
  if (!(await isSupported())) return null;
  return getMessaging(app);
}
