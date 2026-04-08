"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import { GoogleMark } from "@/components/auth/google-mark";
import { mapFirebaseAuthError } from "@/lib/firebase-auth-errors";

type GoogleSignInPanelProps = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

export function GoogleSignInPanel({ onSuccess, onAuthBusyChange }: GoogleSignInPanelProps) {
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      provider.addScope("profile");
      provider.addScope("email");

      await signInWithPopup(auth, provider);
      onSuccess?.();
    } catch (e) {
      const msg = mapFirebaseAuthError(e, "Could not sign in with Google.");
      setError(msg);
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      const silent = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
      if (!silent) {
        showToast({ type: "error", title: "Google sign-in failed", description: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        One tap with your Google account — quick and secure.
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
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden />
        ) : (
          <GoogleMark className="h-5 w-5 shrink-0" />
        )}
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
    </div>
  );
}
