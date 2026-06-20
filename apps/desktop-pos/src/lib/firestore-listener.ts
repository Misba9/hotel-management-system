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

/** Standard listener error logging (always on — not dev-only). */
export function logFirestoreListenerError(scope: string, error: unknown): void {
  if (error instanceof FirebaseError) {
    console.error("Firestore Listener Error:", scope, error.code, error.message, error);
    return;
  }
  console.error("Firestore Listener Error:", scope, error);
}

export function logFirestoreOperationError(scope: string, error: unknown): void {
  if (error instanceof FirebaseError) {
    console.error("Firestore Error", error.code, error.message, error);
    return;
  }
  console.error("Firestore Error", scope, error);
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
    return onSnapshot(
      source,
      onNext,
      (err) => {
        logFirestoreListenerError(scope, err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
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
  try {
    return onSnapshot(
      ref,
      onNext,
      (err) => {
        logFirestoreListenerError(scope, err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    );
  } catch (err) {
    logFirestoreListenerError(`${scope}.subscribe`, err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
