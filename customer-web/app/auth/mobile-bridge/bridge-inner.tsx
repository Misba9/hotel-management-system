"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  signInWithPopup,
  type Auth
} from "firebase/auth";
import { mapFirebaseAuthError } from "@/lib/firebase-auth-errors";

/**
 * In-browser OAuth bridge for customer-mobile (Expo Go / native).
 * Completes Google or Apple via Firebase popup, then deep-links back with a custom token.
 *
 * Uses the nausheen-fruits-new config (same project as customer-mobile).
 * authDomain must stay *.firebaseapp.com — never a custom brand domain.
 */
const bridgeFirebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyALjFLpZYo4cCPYTls0JGxbqOZzcPBzch0",
  authDomain:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_AUTH_DOMAIN ||
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "nausheen-fruits-new.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "nausheen-fruits-new",
  storageBucket:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "nausheen-fruits-new.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "611343650554",
  appId:
    process.env.NEXT_PUBLIC_MOBILE_BRIDGE_APP_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:611343650554:web:375eeb211c586448df4343"
};

function getBridgeAuth(): Auth {
  const name = "mobile-bridge";
  let app: FirebaseApp;
  try {
    app = getApp(name);
  } catch {
    app = initializeApp(bridgeFirebaseConfig, name);
  }
  return getAuth(app);
}

function isAllowedRedirect(redirect: string): boolean {
  try {
    const u = new URL(redirect);
    return u.protocol === "nausheen-customer:" || u.protocol === "exp:" || u.protocol === "exps:";
  } catch {
    return false;
  }
}

export default function MobileAuthBridgeInner() {
  const params = useSearchParams();
  const provider = (params.get("provider") || "google").toLowerCase();
  const redirect = params.get("redirect") || "";
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Opening sign-in…");

  const providerLabel = useMemo(
    () => (provider === "apple" ? "Apple" : "Google"),
    [provider]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!redirect || !isAllowedRedirect(redirect)) {
        setStatus("error");
        setMessage("Invalid redirect URI. Open this page from the Nausheen customer app.");
        return;
      }
      if (provider !== "google" && provider !== "apple") {
        setStatus("error");
        setMessage("Unsupported provider. Use google or apple.");
        return;
      }

      try {
        setMessage(`Continue with ${providerLabel}…`);
        const auth = getBridgeAuth();
        if (provider === "google") {
          const google = new GoogleAuthProvider();
          google.setCustomParameters({ prompt: "select_account" });
          google.addScope("profile");
          google.addScope("email");
          await signInWithPopup(auth, google);
        } else {
          const apple = new OAuthProvider("apple.com");
          apple.addScope("email");
          apple.addScope("name");
          await signInWithPopup(auth, apple);
        }

        const user = auth.currentUser;
        if (!user) throw new Error("No signed-in user after OAuth.");
        const idToken = await user.getIdToken();

        setMessage("Finishing sign-in…");
        const res = await fetch("/api/auth/exchange-id-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        });
        const data = (await res.json()) as { ok?: boolean; customToken?: string; error?: string };
        if (!res.ok || !data.customToken) {
          throw new Error(data.error || "Could not finish mobile sign-in.");
        }

        if (cancelled) return;
        setStatus("done");
        setMessage("Returning to the app…");
        const target = new URL(redirect);
        target.searchParams.set("customToken", data.customToken);
        target.searchParams.set("provider", provider);
        window.location.href = target.toString();
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setMessage(mapFirebaseAuthError(e, `${providerLabel} sign-in failed.`));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [provider, providerLabel, redirect]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Nausheen Fruits</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-600">{message}</p>
      {status === "error" ? (
        <p className="mt-4 text-xs text-slate-500">You can close this tab and try again in the app.</p>
      ) : null}
    </main>
  );
}
