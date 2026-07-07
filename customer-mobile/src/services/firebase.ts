/**
 * Single Firebase App + Firestore for Customer Mobile (Expo).
 * Project: `nausheen-fruits-new` — values from `customer-mobile/.env` (`EXPO_PUBLIC_*`).
 */
declare const process: { env: Record<string, string | undefined> };

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Platform } from "react-native";
import {
  enableNetwork,
  getFirestore,
  initializeFirestore,
  type Firestore,
  type FirestoreSettings
} from "firebase/firestore";
import { normalizeFirebaseStorageBucket } from "@shared/utils/normalize-firebase-storage-bucket";
import { EXPECTED_NATIVE_PROJECT_ID } from "../config/firebase-project-lock";

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

const projectId = env("EXPO_PUBLIC_FIREBASE_PROJECT_ID") || EXPECTED_NATIVE_PROJECT_ID;

const firebaseConfig = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: normalizeFirebaseStorageBucket(env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"), projectId),
  messagingSenderId: env("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("EXPO_PUBLIC_FIREBASE_APP_ID")
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
      `[Firebase] ${name} missing in customer-mobile/.env. Copy customer-mobile/.env.example and fill values from Firebase Console (same project as google-services.json).`
    );
  }
}

if (firebaseConfig.projectId !== EXPECTED_NATIVE_PROJECT_ID) {
  console.warn(
    `[Firebase] EXPO_PUBLIC_FIREBASE_PROJECT_ID="${firebaseConfig.projectId}" should match google-services.json / firebase-project-lock (${EXPECTED_NATIVE_PROJECT_ID}).`
  );
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const FIRESTORE_SETTINGS: FirestoreSettings & { useFetchStreams?: boolean } = {
  experimentalForceLongPolling: true,
  useFetchStreams: false
};

let firestoreSingleton: Firestore | null = null;

function getCustomerFirestoreInstance(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;

  if (Platform.OS === "web") {
    firestoreSingleton = getFirestore(firebaseApp);
    return firestoreSingleton;
  }

  const useLongPolling = env("EXPO_PUBLIC_FIRESTORE_LONG_POLLING") !== "false";
  if (!useLongPolling) {
    firestoreSingleton = getFirestore(firebaseApp);
    return firestoreSingleton;
  }

  try {
    firestoreSingleton = initializeFirestore(firebaseApp, FIRESTORE_SETTINGS as FirestoreSettings);
  } catch {
    firestoreSingleton = getFirestore(firebaseApp);
  }
  return firestoreSingleton;
}

export const firestoreDb: Firestore = getCustomerFirestoreInstance();
export const db = firestoreDb;

export async function ensureFirestoreOnline(): Promise<void> {
  try {
    await enableNetwork(firestoreDb);
  } catch {
    /* ignore */
  }
}
