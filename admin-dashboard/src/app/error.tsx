"use client";

/**
 * Route error UI — must not render <html>/<body> (those come from root layout).
 * Do not call authenticated APIs here: this runs before/during login and would cascade failures.
 */
export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
      >
        Try again
      </button>
    </div>
  );
}
