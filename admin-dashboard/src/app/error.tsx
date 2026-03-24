"use client";

import { useEffect } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void adminApiFetch("/api/monitoring/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        page: "admin-dashboard",
        userAgent: navigator.userAgent
      })
    });
  }, [error]);

  return (
    <html>
      <body>
        <main className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">Dashboard error</h1>
          <p className="text-sm text-slate-500">The issue has been logged. Retry the page.</p>
          <button onClick={() => reset()} className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white">
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
