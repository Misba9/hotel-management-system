"use client";

import { useEffect } from "react";

/**
 * Segment error boundary — must not render html/body (root layout already provides them).
 * Use `global-error.tsx` at the app root if you need a full-document fallback.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/monitoring/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        page: "customer-web",
        userAgent: navigator.userAgent
      })
    }).catch(() => {
      // Swallow logging failures to avoid cascading from the error boundary itself.
    });
  }, [error]);

  return (
    <main className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-slate-500">Our team has been notified. Please try again.</p>
      <button type="button" onClick={() => reset()} className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white">
        Retry
      </button>
    </main>
  );
}
