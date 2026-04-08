"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

let pendingUserPromise: Promise<User> | null = null;

/**
 * Waits until Firebase Auth has a signed-in user (e.g. right after redirect into /admin).
 * Safe to call from `useEffect` async loaders — pairs with `onAuthStateChanged` until user exists.
 */
async function waitForSignedInUser(timeoutMs = 10_000): Promise<User> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!pendingUserPromise) {
    pendingUserPromise = new Promise<User>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Unauthorized: no authenticated Firebase user found."));
      }, timeoutMs);

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      });
    }).finally(() => {
      pendingUserPromise = null;
    });
  }

  return pendingUserPromise;
}

/**
 * Firebase client SDK: resolve current user, then `getIdToken()`.
 */
export async function getAdminIdToken(options?: { forceRefresh?: boolean }): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser ?? (await waitForSignedInUser());
  return user.getIdToken(Boolean(options?.forceRefresh));
}

const AUTH_HEADER = "Authorization";

/**
 * Headers including `Authorization: Bearer <Firebase ID token>`.
 * Use with raw `fetch` when you cannot use {@link adminApiFetch}.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   void (async () => {
 *     const headers = await getAdminAuthHeaders();
 *     const res = await fetch("/api/dashboard/summary", { headers });
 *   })();
 * }, []);
 * ```
 */
export async function getAdminAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const token = await getAdminIdToken({ forceRefresh: false });
  const headers = new Headers(extra);
  headers.set(AUTH_HEADER, `Bearer ${token}`);
  return headers;
}

function buildRequestInit(init: RequestInit | undefined, bearerToken: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set(AUTH_HEADER, `Bearer ${bearerToken}`);

  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return { ...init, headers };
}

async function readJsonErrorMessage(response: Response): Promise<string | null> {
  try {
    const data: unknown = await response.clone().json();
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/**
 * `fetch` to admin API routes with Firebase ID token:
 * `Authorization: Bearer <token>`.
 *
 * Use from React `useEffect`, event handlers, or any client-only async code.
 * On 401 or 403, retries once with `getIdToken(true)` so new custom claims (e.g. admin role) apply.
 */
export async function adminApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAdminIdToken();
  let response = await fetch(input, buildRequestInit(init, token));

  if (response.status === 401) {
    const refreshed = await getAdminIdToken({ forceRefresh: true });
    response = await fetch(input, buildRequestInit(init, refreshed));
  }

  if (response.status === 403) {
    const refreshed = await getAdminIdToken({ forceRefresh: true });
    response = await fetch(input, buildRequestInit(init, refreshed));
  }

  if (response.status === 401) {
    throw new Error("Unauthorized (401): invalid or missing admin token.");
  }

  if (response.status === 403) {
    const serverMsg = await readJsonErrorMessage(response);
    throw new Error(serverMsg ?? "Forbidden (403): admin access denied.");
  }

  return response;
}
