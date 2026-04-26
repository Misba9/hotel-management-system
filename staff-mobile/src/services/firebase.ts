/**
 * Single Firebase App + Firestore for Staff Mobile (Expo).
 * Project: `nausheen-fruits-new` — values from `staff-mobile/.env` (`EXPO_PUBLIC_*`).
 */
declare const process: { env: Record<string, string | undefined> };

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  enableNetwork,
  getFirestore,
  initializeFirestore,
  type Firestore,
  type FirestoreSettings
} from "firebase/firestore";
import { EXPECTED_NATIVE_PROJECT_ID } from "../config/firebase-project-lock.js";

function env(name: string): string | undefined {
  let raw = process.env[name];
  if (raw == null) return undefined;
  let s = String(raw).replace(/^\uFEFF/, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.length ? s : undefined;
}

const measurementId = env("EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID");

const firebaseConfig = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("EXPO_PUBLIC_FIREBASE_APP_ID"),
  ...(measurementId ? { measurementId } : {})
};

const REQUIRED: [string, string | undefined][] = [
  ["EXPO_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
  ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
  ["EXPO_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId]
];

const PLACEHOLDER = /^(YOUR_API_KEY|XXXX|your-project-id|your-project\.firebaseapp\.com)$/i;

for (const [name, value] of REQUIRED) {
  const s = value == null ? "" : String(value).trim();
  if (!s || PLACEHOLDER.test(s)) {
    throw new Error(
      `[Firebase] ${name} missing in staff-mobile/.env. Copy from Firebase Console (Web app), same project as google-services.json.`
    );
  }
}

if (firebaseConfig.projectId !== EXPECTED_NATIVE_PROJECT_ID) {
  console.warn(
    `[Firebase] EXPO_PUBLIC_FIREBASE_PROJECT_ID="${firebaseConfig.projectId}" should match google-services.json / firebase-project-lock (${EXPECTED_NATIVE_PROJECT_ID}).`
  );
}

/** Single default app instance (Expo fast refresh must not create duplicates). */
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

if (app.options.projectId !== firebaseConfig.projectId) {
  console.error(
    `[Firebase] Cached app project "${app.options.projectId}" !== .env "${firebaseConfig.projectId}". Run: npx expo start -c`
  );
}

/**
 * RN / Expo: WebChannel streams often fail on some networks (RPC Listen transport errors).
 * Long polling + disabling fetch streams matches stable browser config; opt out with
 * `EXPO_PUBLIC_FIRESTORE_LONG_POLLING=false`.
 */
function createStaffFirestore(): Firestore {
  const useLongPolling = env("EXPO_PUBLIC_FIRESTORE_LONG_POLLING") !== "false";
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

if (typeof __DEV__ !== "undefined" && __DEV__) {
  // eslint-disable-next-line no-console
  console.log("[Firebase] projectId:", app.options.projectId);
}

export const firebaseApp = app;
export const firestoreDb: Firestore = createStaffFirestore();

/** Call after NetInfo reports online or on cold start if listeners stay empty. */
export async function ensureStaffFirestoreOnline(): Promise<void> {
  try {
    await enableNetwork(firestoreDb);
  } catch {
    /* ignore */
  }
}

export function getStaffFirebaseConfig() {
  const o = app.options;
  return {
    apiKey: o.apiKey,
    authDomain: o.authDomain,
    projectId: o.projectId,
    storageBucket: o.storageBucket,
    messagingSenderId: o.messagingSenderId,
    appId: o.appId
  };
}
