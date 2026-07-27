import { FirebaseError } from "firebase/app";
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Unsubscribe
} from "firebase/firestore";

type GlobalListenerRegistry = {
  __staffFirestoreListenerUnsubs?: Map<string, Unsubscribe>;
};

/** Survives Fast Refresh so we can detach orphaned listeners before re-attaching. */
function listenerRegistry(): Map<string, Unsubscribe> {
  const g = globalThis as GlobalListenerRegistry;
  if (!g.__staffFirestoreListenerUnsubs) {
    g.__staffFirestoreListenerUnsubs = new Map();
  }
  return g.__staffFirestoreListenerUnsubs;
}

function detachRegistered(key: string): void {
  const registry = listenerRegistry();
  const prev = registry.get(key);
  if (!prev) return;
  registry.delete(key);
  try {
    prev();
  } catch {
    /* ignore */
  }
}

/** Transient connectivity failures — warn only (avoid RN LogBox red screen). */
export function isOfflineLikeFirestoreError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    if (error.code === "unavailable") return true;
    if (/client is offline/i.test(error.message)) return true;
    if (/network-request-failed/i.test(error.message)) return true;
  }
  if (error instanceof Error && /client is offline|network-request-failed/i.test(error.message)) {
    return true;
  }
  return false;
}

/** Fast Refresh / remount race in the JS SDK (esp. with long-polling). */
export function isTransientListenerRaceError(error: unknown): boolean {
  if (error instanceof FirebaseError && error.code === "already-exists") return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);
  return /Target ID already exists/i.test(message);
}

function logFirestoreFailure(kind: "Listener" | "Error", scope: string, error: unknown): void {
  const soft = isOfflineLikeFirestoreError(error) || isTransientListenerRaceError(error);
  const log = soft ? console.warn : console.error;
  const tag = soft
    ? isTransientListenerRaceError(error)
      ? " (target-race)"
      : " (offline)"
    : "";
  if (error instanceof FirebaseError) {
    log(`Firestore ${kind}${tag}:`, scope, error.code, error.message);
    return;
  }
  log(`Firestore ${kind}${tag}:`, scope, error);
}

/** Standard listener error logging (always on — not dev-only). */
export function logFirestoreListenerError(scope: string, error: unknown): void {
  logFirestoreFailure("Listener", scope, error);
}

export function logFirestoreOperationError(scope: string, error: unknown): void {
  logFirestoreFailure("Error", scope, error);
}

/**
 * Attach an onSnapshot, replacing any prior listener for `key`.
 * Retries once on Target-ID races; ignores that error for callers (non-fatal).
 */
function manageSnapshotListener(
  key: string,
  attach: (onError: (err: Error) => void) => Unsubscribe,
  onError?: (err: Error) => void
): Unsubscribe {
  detachRegistered(key);

  let disposed = false;
  let activeUnsub: Unsubscribe | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let retried = false;

  const clearPending = () => {
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      pendingTimer = undefined;
    }
  };

  const registryDeleteSelf = () => {
    const registry = listenerRegistry();
    if (registry.get(key) === dispose) registry.delete(key);
  };

  const handleError = (err: Error) => {
    if (disposed) return;
    logFirestoreListenerError(key, err);
    if (isTransientListenerRaceError(err) && !retried) {
      retried = true;
      try {
        activeUnsub?.();
      } catch {
        /* ignore */
      }
      activeUnsub = null;
      clearPending();
      pendingTimer = setTimeout(() => {
        pendingTimer = undefined;
        if (disposed) return;
        start();
      }, 75);
      return;
    }
    if (isTransientListenerRaceError(err) || isOfflineLikeFirestoreError(err)) {
      // Soft: keep UI state; offline recovers when network returns.
      return;
    }
    onError?.(err);
  };

  const start = () => {
    if (disposed) return;
    activeUnsub = attach((err) => handleError(err instanceof Error ? err : new Error(String(err))));
  };

  const dispose: Unsubscribe = () => {
    if (disposed) return;
    disposed = true;
    clearPending();
    registryDeleteSelf();
    try {
      activeUnsub?.();
    } catch {
      /* ignore */
    }
    activeUnsub = null;
  };

  // Defer one tick so React Strict Mode / Fast Refresh cleanup can finish first.
  pendingTimer = setTimeout(() => {
    pendingTimer = undefined;
    if (disposed) return;
    start();
  }, 0);

  listenerRegistry().set(key, dispose);
  return dispose;
}

/**
 * `onSnapshot` with mandatory error callback + logging.
 * Returns `null` when `source` is missing (caller should no-op).
 */
export function subscribeFirestoreQuery(
  scope: string,
  source: Query,
  onNext: (snapshot: QuerySnapshot) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    return manageSnapshotListener(
      scope,
      (onSnapError) => onSnapshot(source, onNext, onSnapError),
      onError
    );
  } catch (err) {
    logFirestoreListenerError(`${scope}.subscribe`, err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

export function subscribeFirestoreDocument(
  scope: string,
  ref: DocumentReference<DocumentData>,
  onNext: (snapshot: DocumentSnapshot<DocumentData>) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  if (!ref.id?.trim()) {
    console.error("Missing document id", scope);
    return null;
  }
  const key = `${scope}:${ref.path}`;
  try {
    return manageSnapshotListener(
      key,
      (onSnapError) => onSnapshot(ref, onNext, onSnapError),
      onError
    );
  } catch (err) {
    logFirestoreListenerError(`${scope}.subscribe`, err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
