"use client";

import { BarChart3 } from "lucide-react";

/** Placeholder — wire to BigQuery, GA, or custom charts later. */
export function AnalyticsPageFeature() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/40">
          <BarChart3 className="h-7 w-7 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">Analytics</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Revenue trends, conversion, and cohort charts can plug in here. Your orders feed supports export-ready data from
          Firestore.
        </p>
      </div>
    </section>
  );
}
