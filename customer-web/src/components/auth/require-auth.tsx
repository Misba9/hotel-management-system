"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth, type OpenAuthModalOptions } from "@/context/auth-context";

export type RequireAuthProps = {
  children: ReactNode;
  /** Replaces default signed-out card when the session is known but there is no user. */
  fallback?: ReactNode;
  /** Automatically open the login modal once per visit when unauthenticated. */
  autoOpenModal?: boolean;
  /** Replaces the default auth-loading spinner. */
  loadingFallback?: ReactNode;
} & OpenAuthModalOptions;

/**
 * Gates content behind Firebase Auth. Uses the same `onAuthStateChanged` session as the rest of the app (no reloads).
 * Optionally opens the login modal once (Zomato-style) so users can complete OTP / Google / email / Apple in-place.
 */
export function RequireAuth({
  children,
  fallback,
  autoOpenModal = true,
  loadingFallback,
  fullPageLoginHref,
  modalTitle,
  modalDescription
}: RequireAuthProps) {
  const { user, authReady, login } = useAuth();
  const pathname = usePathname() ?? "/";
  const promptedRef = useRef(false);

  const resolvedLoginHref = fullPageLoginHref ?? `/login?redirect=${encodeURIComponent(pathname)}`;

  const openLogin = () => {
    login({
      fullPageLoginHref: resolvedLoginHref,
      modalTitle,
      modalDescription
    });
  };

  useEffect(() => {
    if (user) promptedRef.current = false;
  }, [user]);

  useEffect(() => {
    if (!authReady || user || !autoOpenModal) return;
    if (promptedRef.current) return;
    promptedRef.current = true;
    login({
      fullPageLoginHref: resolvedLoginHref,
      modalTitle,
      modalDescription
    });
  }, [authReady, user, autoOpenModal, resolvedLoginHref, modalTitle, modalDescription, login]);

  if (!authReady) {
    return (
      loadingFallback ?? (
        <section
          className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-8"
          aria-busy="true"
          aria-label="Loading session"
        >
          <Loader2 className="h-9 w-9 animate-spin text-orange-500" aria-hidden />
          <p className="text-sm text-slate-500 dark:text-slate-400">Checking your session…</p>
        </section>
      )
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <section className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{modalTitle ?? "Sign in required"}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {modalDescription ?? "Use phone OTP, email, Google, or Apple — you’ll stay on this page after signing in."}
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="mt-6 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600"
          >
            Sign in
          </button>
          <Link
            href={resolvedLoginHref}
            className="mt-4 block text-sm font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
          >
            Open full login page
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
