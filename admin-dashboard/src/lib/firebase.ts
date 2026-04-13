/**
 * Firebase Web SDK (modular v9+) for the admin dashboard.
 *
 * - Reads `process.env.NEXT_PUBLIC_*` (validated in `getFirebaseWebConfig`; see `.env.example`).
 * - Browser-only: `getFirebaseApp` / `getFirebaseAuth` throw on the server.
 * - Analytics: `initFirebaseAnalytics()` from a client `useEffect` only (see `FirebaseAnalytics`).
 */
import { getApp, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/** Re-export for consumers typing auth without importing `firebase/auth` directly. */
export type { Auth };

/** Isolated app name so we never reuse a `[DEFAULT]` app from another bundle or stale config */
const FIREBASE_APP_NAME = "nausheen-admin-dashboard";

/**
 * Trim and strip accidental quotes from .env values.
 * Use only with static `process.env.NEXT_PUBLIC_*` reads — Next.js inlines those for the
 * browser bundle. Dynamic `process.env[name]` is NOT inlined, so client code would see
 * undefined and trigger "Missing env" at runtime.
 */
function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

/**
 * Validates env and cross-checks appId ↔ messagingSenderId (same GCP project).
 */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  const missing: string[] = [];
  const apiKey = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const appId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
  const measurementId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);

  if (!apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  if (missing.length > 0) {
    throw new Error(
      `[firebase] Missing env: ${missing.join(", ")}. ` +
        `Put them in admin-dashboard/.env.local (not the repo root), then restart \`npm run dev\`.`
    );
  }

  const appIdParts = appId!.split(":");
  if (appIdParts.length >= 2 && appIdParts[1] !== messagingSenderId) {
    throw new Error(
      `[firebase] Config mismatch: NEXT_PUBLIC_FIREBASE_APP_ID must belong to the same project as NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID (appId project number ${appIdParts[1]} vs senderId ${messagingSenderId}). Copy all values from the same Web app in Firebase Console.`
    );
  }

  const config: FirebaseWebConfig = {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId: messagingSenderId!,
    appId: appId!
  };
  if (measurementId) config.measurementId = measurementId;
  return config;
}

function getFirebaseOptions(): FirebaseOptions {
  const c = getFirebaseWebConfig();
  const opts: FirebaseOptions = {
    apiKey: c.apiKey,
    authDomain: c.authDomain,
    projectId: c.projectId,
    storageBucket: c.storageBucket,
    messagingSenderId: c.messagingSenderId,
    appId: c.appId
  };
  if (c.measurementId) opts.measurementId = c.measurementId;
  return opts;
}

/** Dev-only: confirm client bundle embedded config (no secrets logged). */
export function logFirebaseConfigDebug(): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    const c = getFirebaseWebConfig();
    const key = c.apiKey;
    console.info(
      `[firebase] projectId=${c.projectId} apiKey loaded=${Boolean(key)} len=${key.length} prefix=${key.slice(0, 8)}… authDomain=${c.authDomain}`
    );
  } catch (e) {
    console.error("[firebase] config error:", e);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let analyticsInitStarted = false;

function getOrCreateFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = getApp(FIREBASE_APP_NAME);
    return firebaseApp;
  } catch {
    /* no named app yet */
  }

  const opts = getFirebaseOptions();
  firebaseApp = initializeApp(opts, FIREBASE_APP_NAME);
  return firebaseApp;
}

/**
 * Single Firebase app for this dashboard (named instance — avoids wrong `[DEFAULT]` app).
 */
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error(
      "[firebase] Client SDK only in the browser. Import `@/lib/firebase` from Client Components (`\"use client\"`)."
    );
  }

  return getOrCreateFirebaseApp();
}

export function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("[firebase] getFirebaseAuth() is browser-only.");
  }
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp());
  }
  return firebaseAuth;
}

export function getFirebaseDb(): Firestore {
  if (typeof window === "undefined") {
    throw new Error("[firebase] getFirebaseDb() is browser-only.");
  }
  if (!firestoreDb) {
    firestoreDb = getFirestore(getFirebaseApp());
  }
  return firestoreDb;
}

export async function initFirebaseAnalytics(): Promise<void> {
  if (typeof window === "undefined" || analyticsInitStarted) return;
  const cfg = getFirebaseWebConfig();
  if (!cfg.measurementId) return;

  analyticsInitStarted = true;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (!(await isSupported())) {
      analyticsInitStarted = false;
      return;
    }
    getAnalytics(getFirebaseApp());
  } catch {
    analyticsInitStarted = false;
  }
}
