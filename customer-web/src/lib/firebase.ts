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
  memoryLocalCache,
  type Firestore,
  type FirestoreSettings
} from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { normalizeFirebaseStorageBucket } from "@shared/utils/normalize-firebase-storage-bucket";

const EXPECTED_PROJECT_ID = "nausheen-fruits-new";

function trimEnv(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 * authDomain MUST be `<projectId>.firebaseapp.com`.
 * Custom brand domains as authDomain cause Google Error 400 redirect_uri_mismatch
 * unless Firebase Custom Auth Domain is explicitly configured.
 */
function resolveAuthDomain(projectId: string, rawAuthDomain: string): string {
  const fallback = `${projectId}.firebaseapp.com`;
  if (!rawAuthDomain) return fallback;
  if (!rawAuthDomain.endsWith(".firebaseapp.com")) {
    console.error(
      `[firebase] Ignoring authDomain="${rawAuthDomain}" (not *.firebaseapp.com). ` +
        `Using "${fallback}" to prevent Google redirect_uri_mismatch.`
    );
    return fallback;
  }
  if (rawAuthDomain !== fallback) {
    console.warn(
      `[firebase] authDomain="${rawAuthDomain}" does not match projectId="${projectId}". Using "${fallback}".`
    );
    return fallback;
  }
  return rawAuthDomain;
}

/**
 * Customer web Firebase — `initializeApp` once (`getApps()` guard).
 *
 * Firestore uses in-memory cache (not IndexedDB multi-tab persistence).
 * Forced long-polling + persistentMultipleTabManager caused production crashes:
 * FIRESTORE INTERNAL ASSERTION FAILED (ID: ca9, ve: -1) after Google Sign-In.
 * See firebase-js-sdk#9267.
 *
 * Opt-in long polling only when needed: NEXT_PUBLIC_FIRESTORE_LONG_POLLING=true
 * (uses experimentalAutoDetectLongPolling, never experimentalForceLongPolling).
 */
function buildFirebaseConfig() {
  const projectId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || EXPECTED_PROJECT_ID;
  const authDomain = resolveAuthDomain(
    projectId,
    trimEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
  );
  const apiKey = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const messagingSenderId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const appId = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (typeof window !== "undefined") {
    if (projectId !== EXPECTED_PROJECT_ID) {
      console.warn(
        `[firebase] NEXT_PUBLIC_FIREBASE_PROJECT_ID="${projectId}" — expected "${EXPECTED_PROJECT_ID}".`
      );
    }
    const appIdParts = appId.split(":");
    if (appIdParts.length >= 2 && messagingSenderId && appIdParts[1] !== messagingSenderId) {
      console.error(
        `[firebase] APP_ID project number (${appIdParts[1]}) !== MESSAGING_SENDER_ID (${messagingSenderId}). ` +
          `Copy all values from the same Web app in Firebase Console.`
      );
    }
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: normalizeFirebaseStorageBucket(
      trimEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      projectId
    ),
    messagingSenderId,
    appId
  };
}

const firebaseConfig = buildFirebaseConfig();

export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      !firebaseConfig.apiKey.includes("<") &&
      !firebaseConfig.appId.includes("<")
  );
}

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]!;

function createFirestoreInstance(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }

  const settings: FirestoreSettings = {
    localCache: memoryLocalCache()
  };

  // Prefer auto-detect over force — force + persistence caused ca9 assertions in production.
  if (process.env.NEXT_PUBLIC_FIRESTORE_LONG_POLLING === "true") {
    (settings as FirestoreSettings & { experimentalAutoDetectLongPolling?: boolean }).experimentalAutoDetectLongPolling =
      true;
  }

  try {
    return initializeFirestore(app, settings);
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = getAuth(app);
export const db: Firestore = createFirestoreInstance();

export type FirebaseClientDiagnostics = {
  appName: string;
  projectId: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  apiKeyPrefix: string;
  firestoreProjectId: string | undefined;
  authCurrentUid: string | null;
  navigatorOnline: boolean | null;
};

/** Safe diagnostics for auth/Firestore debugging (no full API key). */
export function getFirebaseClientDiagnostics(): FirebaseClientDiagnostics {
  return {
    appName: app.name,
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: String(firebaseConfig.storageBucket ?? ""),
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    apiKeyPrefix: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.slice(0, 8)}…` : "(missing)",
    firestoreProjectId: db.app.options.projectId,
    authCurrentUid: typeof window !== "undefined" ? auth.currentUser?.uid ?? null : null,
    navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : null
  };
}

export function logFirebaseDiagnostics(context: string, extra?: Record<string, unknown>): void {
  console.error(`[firebase] ${context}`, {
    ...getFirebaseClientDiagnostics(),
    ...extra
  });
}

/** Dev-only: confirm client bundle embedded config (no secrets logged). */
export function logFirebaseConfigDebug(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  console.info("[firebase] config", getFirebaseClientDiagnostics());
}

const ENSURE_FIRESTORE_ONLINE_CAP_MS = 8_000;
let firestoreNetworkReady: Promise<void> | null = null;

/**
 * Wake Firestore once per page load. Repeated enableNetwork() calls have been
 * linked to b815 assertions (firebase-js-sdk#9968).
 */
export async function ensureFirestoreOnline(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!firestoreNetworkReady) {
    firestoreNetworkReady = (async () => {
      try {
        await Promise.race([
          enableNetwork(db),
          new Promise<void>((resolve) => setTimeout(resolve, ENSURE_FIRESTORE_ONLINE_CAP_MS))
        ]);
      } catch {
        /* already enabled or transient */
      }
    })();
  }
  await firestoreNetworkReady;
}

if (typeof window !== "undefined") {
  void ensureFirestoreOnline();
  if (process.env.NODE_ENV !== "production") {
    logFirebaseConfigDebug();
  }
}

/** SDK hardAssert failures (e.g. ca9 / b815) — AsyncQueue is dead; retries make it worse. */
export function isFirestoreInternalAssertionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /INTERNAL ASSERTION FAILED/i.test(message) || /\(ID:\s*(ca9|b815)\)/i.test(message);
}

export function isOfflineLikeFirestoreError(error: unknown): boolean {
  if (isFirestoreInternalAssertionError(error)) return false;
  if (error instanceof FirebaseError) {
    if (error.code === "unavailable") return true;
    if (/offline/i.test(error.message)) return true;
    if (/Failed to get document because the client is offline/i.test(error.message)) return true;
  }
  if (error instanceof Error && /client is offline/i.test(error.message)) return true;
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

/**
 * Network getDoc with online wake-up + limited retries.
 * Does not retry Firestore INTERNAL ASSERTION failures (client is unrecoverable until reload).
 */
export async function safeGetDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  retries = 2
): Promise<DocumentSnapshot<T>> {
  await ensureFirestoreOnline();
  try {
    return await getDoc(ref);
  } catch (error) {
    if (isFirestoreInternalAssertionError(error)) {
      logFirebaseDiagnostics("safeGetDoc aborted — Firestore internal assertion (reload required)", {
        path: ref.path,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    const offline = isOfflineLikeFirestoreError(error);
    const retryable = offline || code === "unavailable" || code === "failed-precondition";

    if (retryable && retries > 0) {
      logFirebaseDiagnostics("safeGetDoc retry", {
        path: ref.path,
        code: code || "(none)",
        message: error instanceof Error ? error.message : String(error),
        retriesLeft: retries - 1
      });
      await ensureFirestoreOnline();
      await new Promise((resolve) => setTimeout(resolve, offline ? 1200 : 800));
      return safeGetDoc(ref, retries - 1);
    }

    logFirebaseDiagnostics("safeGetDoc failed", {
      path: ref.path,
      code: code || "(none)",
      message: error instanceof Error ? error.message : String(error)
    });
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
