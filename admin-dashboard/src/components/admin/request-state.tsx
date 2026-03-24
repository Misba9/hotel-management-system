"use client";

type RequestStateProps = {
  error?: string | null;
  loading?: boolean;
  empty?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
};

export function RequestState({
  error,
  loading = false,
  empty = false,
  loadingMessage = "Loading...",
  emptyMessage = "No data found."
}: RequestStateProps) {
  return (
    <>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">{loadingMessage}</p> : null}
      {empty && !loading ? <p className="text-sm text-slate-500">{emptyMessage}</p> : null}
    </>
  );
}
