"use client";

import { auth } from "@shared/firebase/client";

const GUEST_ID_KEY = "nausheen_guest_id";

function generateGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateGuestId(): string {
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const created = generateGuestId();
  window.localStorage.setItem(GUEST_ID_KEY, created);
  return created;
}

export async function buildUserHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
    return headers;
  }

  const guestId = getOrCreateGuestId();
  headers.set("x-guest-id", guestId);
  return headers;
}

export async function buildAuthHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required.");
  }

  const token = await currentUser.getIdToken();
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
