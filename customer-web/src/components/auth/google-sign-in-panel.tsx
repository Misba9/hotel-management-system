"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth, logFirebaseDiagnostics } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import { GoogleMark } from "@/components/auth/google-mark";
import { mapFirebaseAuthError } from "@/lib/firebase-auth-errors";
import { syncUserToFirestore } from "@/lib/sync-user-to-firestore";

const EXPECTED_AUTH_DOMAIN = "nausheen-fruits-new.firebaseapp.com";
const EXPECTED_PROJECT_ID = "nausheen-fruits-new";
const EXPECTED_REDIRECT_URI = `https://${EXPECTED_AUTH_DOMAIN}/__/auth/handler`;

type GoogleSignInPanelProps = {
  onSuccess?: () => void;
  onAuthBusyChange?: (busy: boolean) => void;
};

/**
 * Customer-web Google Sign-In — Firebase Auth ONLY.
 * Uses GoogleAuthProvider + signInWithPopup. No GIS / gapi / manual OAuth URLs.
 */
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
      const opts = auth.app.options;
      console.log("Firebase Project:", opts.projectId);
      console.log("Auth Domain:", opts.authDomain);
      console.log("App ID:", opts.appId);
      console.log("Current URL:", typeof window !== "undefined" ? window.location.href : "(ssr)");
      console.log("Using Popup:", true);
      console.log("Expected Google redirect_uri:", EXPECTED_REDIRECT_URI);

      if (opts.projectId !== EXPECTED_PROJECT_ID || opts.authDomain !== EXPECTED_AUTH_DOMAIN) {
        const msg =
          `Firebase Auth config mismatch. projectId="${opts.projectId}" authDomain="${opts.authDomain}". ` +
          `Expected projectId="${EXPECTED_PROJECT_ID}" authDomain="${EXPECTED_AUTH_DOMAIN}". ` +
          `Restart the Next.js server after fixing .env.local.`;
        console.error("[Google Sign-In]", msg);
        throw new Error(msg);
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      provider.addScope("profile");
      provider.addScope("email");

      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user);
      onSuccess?.();
    } catch (e) {
      logFirebaseDiagnostics("Google signInWithPopup failed", {
        code: e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "(none)",
        message: e instanceof Error ? e.message : String(e),
        expectedRedirectUri: EXPECTED_REDIRECT_URI
      });
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
