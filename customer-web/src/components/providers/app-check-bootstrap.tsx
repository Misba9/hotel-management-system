"use client";

import { useEffect } from "react";
import { getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

let appCheckStarted = false;

/**
 * Firebase App Check (reCAPTCHA v3 provider). Safe to call once per page load.
 * Register the debug token from the console when using `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true` in development.
 */
export function AppCheckBootstrap() {
  useEffect(() => {
    if (appCheckStarted) return;
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    if (process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN === "true") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    try {
      const app = getApp();
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      appCheckStarted = true;
    } catch {
      /* already initialized or SSR guard */
    }
  }, []);

  return null;
}
