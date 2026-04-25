"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for `/menu` — catches failures in `menu/layout` and `menu/page`
 * so the dev overlay does not surface as a broken route / “missing error components” edge case.
 */
export default function MenuRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/monitoring/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        page: "customer-web/menu",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : ""
      })
    }).catch(() => {});
  }, [error]);

  return (
    <section className="mx-auto max-w-xl space-y-3 px-4 py-12 text-center sm:px-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Menu could not load</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">{error.message || "Something went wrong."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </section>
  );
}
