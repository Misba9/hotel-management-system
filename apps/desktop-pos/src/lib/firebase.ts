/**
 * Firebase Auth scaffolding only — POS runs offline; auth is optional at startup.
 * Reads `NEXT_PUBLIC_*` (or `VITE_*`) from the monorepo root `.env` via Vite.
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}

function env(name: string): string | undefined {
  return trimEnv(import.meta.env[name as keyof ImportMetaEnv] as string | undefined);
}

function readFirebaseConfig() {
  return {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY") ?? env("VITE_FIREBASE_API_KEY"),
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? env("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? env("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ?? env("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId:
      env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID") ?? env("VITE_FIREBASE_APP_ID")
  };
}

const FIREBASE_APP_NAME = "nausheen-desktop-pos";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;

export function getPosFirebaseApp(): FirebaseApp | null {
  const config = readFirebaseConfig();
  if (!config.apiKey || !config.projectId || !config.appId) {
    console.warn("[firebase] Auth scaffolding disabled — missing root .env Firebase keys.");
    return null;
  }

  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = getApp(FIREBASE_APP_NAME);
  } catch {
    firebaseApp = initializeApp(config, FIREBASE_APP_NAME);
  }

  return firebaseApp;
}

export function getPosFirebaseAuth(): Auth | null {
  const app = getPosFirebaseApp();
  if (!app) return null;
  if (!firebaseAuth) firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export function getPosFirestore(): Firestore | null {
  const app = getPosFirebaseApp();
  if (!app) return null;
  if (!firebaseDb) firebaseDb = getFirestore(app);
  return firebaseDb;
}

/** Alias matching staff-mobile naming — call at runtime after bootstrap. */
export function getStaffDb(): Firestore | null {
  return getPosFirestore();
}

export function getStaffAuth(): Auth | null {
  return getPosFirebaseAuth();
}

/** Best-effort anonymous auth when online; never blocks local POS flows. */
export async function bootstrapPosAuth(onUser?: (user: User | null) => void): Promise<void> {
  const auth = getPosFirebaseAuth();
  if (!auth) {
    onUser?.(null);
    return;
  }

  onAuthStateChanged(auth, (user) => onUser?.(user));

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.warn("[firebase] Anonymous sign-in skipped (offline or misconfigured):", error);
  }
}

export function getFirebaseProjectLabel(): string | null {
  return readFirebaseConfig().projectId ?? null;
}
