import { FirebaseError } from "firebase/app";

/** Firestore client error when a composite index is missing (message includes console link). */
export function isFirestoreCompositeIndexError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return /requires an index/i.test(msg);
}

/** Short, user-facing copy; optional `indexUrl` from `extractFirestoreIndexUrl`. */
export function formatFirestoreIndexErrorMessage(err: unknown): { title: string; body: string; indexUrl: string | null } {
  const indexUrl = extractFirestoreIndexUrl(err);
  const raw = err instanceof Error ? err.message : String(err);
  if (isFirestoreCompositeIndexError(err)) {
    return {
      title: "Database index required",
      body:
        "This screen needs a Firestore composite index (status + createdAt). Ask an admin to deploy indexes from the repo, or open the Firebase console link below.",
      indexUrl
    };
  }
  return {
    title: "Could not load orders",
    body: raw.length > 220 ? `${raw.slice(0, 217)}…` : raw,
    indexUrl
  };
}

export function extractFirestoreIndexUrl(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = msg.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
  return m ? m[0].replace(/["')\]}]+$/, "") : null;
}

export function logFirestoreQueryError(scope: string, err: unknown): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  const url = extractFirestoreIndexUrl(err);
  // eslint-disable-next-line no-console
  console.warn(`[firestore:${scope}]`, err instanceof FirebaseError ? `${err.code} ${err.message}` : err);
  if (url) {
    // eslint-disable-next-line no-console
    console.warn(`[firestore:${scope}] create index:`, url);
  }
}
