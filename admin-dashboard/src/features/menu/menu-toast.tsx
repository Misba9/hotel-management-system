"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";

export type MenuToastPayload =
  | { type: "success" | "error"; message: string }
  | null;

type Props = {
  toast: MenuToastPayload;
  onDismiss: () => void;
};

export function MenuToast({ toast, onDismiss }: Props) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-[120] flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : "bg-red-50 text-red-600 dark:bg-red-950/40"
        }`}
      >
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
      </span>
      <p className={`text-sm font-medium ${ok ? "text-slate-800 dark:text-slate-100" : "text-red-800 dark:text-red-100"}`}>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
