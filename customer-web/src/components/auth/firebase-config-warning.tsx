"use client";

import { isFirebaseClientConfigured } from "@/lib/firebase";

/**
 * Dev-facing banner when public Firebase env vars are missing.
 */
export function FirebaseConfigWarning() {
  if (isFirebaseClientConfigured()) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 sm:text-sm"
    >
      <strong>Firebase not configured.</strong> Add{" "}
      <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">NEXT_PUBLIC_FIREBASE_*</code> to{" "}
      <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">customer-web/.env.local</code> (see Firebase
      Console → Project settings → Your apps). For Phone Auth, add{" "}
      <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-900/80">localhost</code> under Authentication →
      Authorized domains.
    </div>
  );
}
