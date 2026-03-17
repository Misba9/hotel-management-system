"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <html>
      <body>
        <main className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-slate-500">Our team has been notified. Please try again.</p>
          <button onClick={() => reset()} className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white">
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
