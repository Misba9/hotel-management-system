import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
  type FirestoreSettings
} from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

/**
 * Customer web Firebase — `initializeApp` once (`getApps()` guard).
 * Browser: `initializeFirestore` + long polling + `useFetchStreams: false` (stable behind proxies/VPNs).
 * Server / RSC: `getFirestore` only.
 * Opt out: `NEXT_PUBLIC_FIRESTORE_LONG_POLLING=false`.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "nausheen-fruits-new.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nausheen-fruits-new",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "nausheen-fruits-new.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ""
};

export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

function createFirestoreInstance(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }

  const useLongPolling = process.env.NEXT_PUBLIC_FIRESTORE_LONG_POLLING !== "false";
  if (!useLongPolling) {
    return getFirestore(app);
  }

  const settings: FirestoreSettings & { useFetchStreams?: boolean } = {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  };

  try {
    return initializeFirestore(app, settings as FirestoreSettings);
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = getAuth(app);
export const db: Firestore = createFirestoreInstance();

export async function getClientMessaging() {
  try {
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}
