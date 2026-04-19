"use client";

import { useEffect } from "react";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFirebaseApp } from "@/lib/firebase";

let started = false;

export function AdminAppCheckBootstrap() {
  useEffect(() => {
    if (started) return;
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    if (process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN === "true") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    try {
      const app = getFirebaseApp();
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      started = true;
    } catch {
      /* already initialized */
    }
  }, []);

  return null;
}
