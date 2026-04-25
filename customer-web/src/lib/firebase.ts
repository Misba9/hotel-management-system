import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  enableNetwork,
  getDoc,
  getDocFromCache,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
  type FirestoreSettings
} from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { normalizeFirebaseStorageBucket } from "@shared/utils/normalize-firebase-storage-bucket";

const customerProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nausheen-fruits-new";

/**
 * Customer web Firebase — `initializeApp` once (`getApps()` guard).
 * Browser: `initializeFirestore` + long polling + `useFetchStreams: false` (stable behind proxies/VPNs).
 * Server / RSC: `getFirestore` only.
 * Opt out: `NEXT_PUBLIC_FIRESTORE_LONG_POLLING=false`.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "nausheen-fruits-new.firebaseapp.com",
  projectId: customerProjectId,
  storageBucket: normalizeFirebaseStorageBucket(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    customerProjectId
  ),
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
    useFetchStreams: false,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  };

  try {
    return initializeFirestore(app, settings as FirestoreSettings);
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = getAuth(app);
export const db: Firestore = createFirestoreInstance();

/**
 * Firestore can stay in a "client is offline" state after tab sleep or failed connects.
 * Call before reads/writes that must hit the network (getDoc with no local cache, setDoc, etc.).
 */
const ENSURE_FIRESTORE_ONLINE_CAP_MS = 8_000;

export async function ensureFirestoreOnline(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await Promise.race([
      enableNetwork(db),
      new Promise<void>((resolve) => setTimeout(resolve, ENSURE_FIRESTORE_ONLINE_CAP_MS))
    ]);
  } catch {
    /* already enabled or transient */
  }
}

if (typeof window !== "undefined") {
  void ensureFirestoreOnline();
}

function isOfflineLikeFirestoreError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    if (error.code === "unavailable" && /offline/i.test(error.message)) return true;
    if (/client is offline/i.test(error.message)) return true;
  }
  return false;
}

/**
 * Read a single doc from the local persistence cache only (no network).
 * Returns `null` if the doc is not cached or cache read fails.
 */
export async function tryGetDocFromCache<T extends DocumentData>(
  ref: DocumentReference<T>
): Promise<DocumentSnapshot<T> | null> {
  try {
    return await getDocFromCache(ref);
  } catch {
    return null;
  }
}

export async function safeGetDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  retries = 1
): Promise<DocumentSnapshot<T>> {
  try {
    return await getDoc(ref);
  } catch (error) {
    if (isOfflineLikeFirestoreError(error)) throw error;
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    if ((code === "unavailable" || code === "failed-precondition") && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return safeGetDoc(ref, retries - 1);
    }
    throw error;
  }
}

export async function getClientMessaging() {
  try {
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}
