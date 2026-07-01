import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastPayload = { title: string; description?: string };

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
  current: ToastPayload | null;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastPayload | null>(null);

  const showToast = useCallback((payload: ToastPayload) => {
    setCurrent(payload);
    setTimeout(() => setCurrent(null), 3000);
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ showToast, current, dismiss }), [showToast, current, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
