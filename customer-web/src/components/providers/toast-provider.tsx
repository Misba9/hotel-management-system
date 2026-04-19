"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastType = "success" | "error" | "warning";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (input: { title: string; description?: string; type?: ToastType }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, type = "success" }: { title: string; description?: string; type?: ToastType }) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title, description, type }]);
      window.setTimeout(() => dismiss(id), 2600);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[110] mx-auto w-full max-w-md px-3 max-sm:top-[max(0.75rem,env(safe-area-inset-top))]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="pointer-events-auto mb-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900/95"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex items-start gap-2">
                  {toast.type === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  ) : toast.type === "warning" ? (
                    <Info className="mt-0.5 h-4 w-4 text-amber-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
                    {toast.description ? (
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{toast.description}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label="Dismiss toast"
                  onClick={() => dismiss(toast.id)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
