"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@shared/firebase/client";

let pendingUserPromise: Promise<User> | null = null;

async function waitForSignedInUser(timeoutMs = 5000): Promise<User> {
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

export async function getAdminIdToken(): Promise<string> {
  const user = await waitForSignedInUser();
  return user.getIdToken();
}

export async function adminApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAdminIdToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    throw new Error("Unauthorized (401): invalid or missing admin token.");
  }

  if (response.status === 403) {
    throw new Error("Forbidden (403): admin role required.");
  }

  return response;
}
