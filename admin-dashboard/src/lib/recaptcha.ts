declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SCRIPT_ID = "google-recaptcha-v3";

function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is browser-only."));
  }
  if (window.grecaptcha?.execute) {
    return Promise.resolve();
  }
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing?.src) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        if (window.grecaptcha?.execute) {
          resolve();
          return;
        }
        if (Date.now() - t0 > 15_000) {
          reject(new Error("reCAPTCHA script load timed out."));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA."));
    document.head.appendChild(s);
  });
}

/**
 * Google reCAPTCHA v3 (invisible). Use e.g. `admin_login` for the admin dashboard.
 */
export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    throw new Error("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set.");
  }
  await loadRecaptchaScript(siteKey);
  return await window.grecaptcha!.execute(siteKey, { action });
}
