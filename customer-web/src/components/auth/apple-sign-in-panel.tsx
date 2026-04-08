"use client";

import { useEffect, useState } from "react";
import { OAuthProvider, signInWithPopup } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import { mapFirebaseAuthError } from "@/lib/firebase-auth-errors";

type AppleSignInPanelProps = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

export function AppleSignInPanel({ onSuccess, onAuthBusyChange }: AppleSignInPanelProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onAuthBusyChange?.(loading);
  }, [loading, onAuthBusyChange]);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");

      await signInWithPopup(auth, provider);
      onSuccess?.();
    } catch (e) {
      const msg = mapFirebaseAuthError(e, "Could not sign in with Apple.");
      setError(msg);
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      const silent = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
      if (!silent) {
        showToast({ type: "error", title: "Apple sign-in failed", description: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Sign in with your Apple ID. Enable the Apple provider in Firebase Console and configure Services ID &amp; key.
      </p>
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-black py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-black"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white/80" aria-hidden />
        ) : (
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
          </svg>
        )}
        {loading ? "Signing in…" : "Continue with Apple"}
      </button>
    </div>
  );
}
