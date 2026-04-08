import type { Auth } from "firebase/auth";
import { RecaptchaVerifier } from "firebase/auth";

/**
 * Structured logs for phone OTP / reCAPTCHA (errors always visible in prod for support).
 * Checklist for local dev: Firebase Console → Auth → Authorized domains: `localhost`, `127.0.0.1`;
 * Google Cloud → APIs: enable **Identity Toolkit API**; Credentials: Browser key not over-restricted for localhost.
 */
export function logPhoneAuthEvent(
  level: "debug" | "info" | "warn" | "error",
  phase: string,
  detail?: Record<string, unknown>
): void {
  const payload = { tag: "phone-otp", phase, ts: new Date().toISOString(), ...detail };
  const line = () => JSON.stringify(payload);
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  switch (level) {
    case "error":
      console.error(line());
      break;
    case "warn":
      console.warn(line());
      break;
    case "info":
      console.info(line());
      break;
    default:
      console.debug(line());
  }
}

/** Dev-only verbose helper (kept for stack traces in development). */
export function logPhoneAuthDebug(phase: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  if (detail !== undefined) {
    console.debug(`[phone-auth] ${phase}`, detail);
  } else {
    console.debug(`[phone-auth] ${phase}`);
  }
}

function clearVerifierInstance(): void {
  if (typeof window === "undefined") return;
  const v = window.recaptchaVerifier;
  if (!v) return;
  try {
    v.clear();
    logPhoneAuthEvent("info", "recaptchaVerifier.clear()");
  } catch (e) {
    logPhoneAuthEvent("warn", "recaptchaVerifier.clear failed", {
      message: e instanceof Error ? e.message : String(e)
    });
  }
  window.recaptchaVerifier = undefined;
  window.__phoneRecaptchaContainerId = undefined;
}

/**
 * Clears the singleton verifier (e.g. unmount, change container, or recover from captcha errors).
 */
export function resetPhoneRecaptchaVerifier(): void {
  clearVerifierInstance();
}

/** @deprecated Use {@link resetPhoneRecaptchaVerifier} */
export function clearWindowRecaptchaVerifier(): void {
  clearVerifierInstance();
}

/** @deprecated Use {@link resetPhoneRecaptchaVerifier} */
export function disposePhoneRecaptchaVerifier(): void {
  resetPhoneRecaptchaVerifier();
}

/**
 * Returns existing `window.recaptchaVerifier` when it was created for the same `containerId`,
 * otherwise builds a single invisible {@link RecaptchaVerifier} and stores it on `window`.
 * Call {@link resetPhoneRecaptchaVerifier} before a new send if you need a fresh widget (e.g. Resend OTP).
 */
export async function getOrCreatePhoneRecaptchaVerifier(
  auth: Auth,
  containerId: string
): Promise<RecaptchaVerifier> {
  const el = typeof document !== "undefined" ? document.getElementById(containerId) : null;
  if (!el) {
    const err = new Error(`reCAPTCHA container #${containerId} not found.`);
    logPhoneAuthEvent("error", "container missing", { containerId });
    throw err;
  }

  const existing = typeof window !== "undefined" ? window.recaptchaVerifier : undefined;
  if (existing && window.__phoneRecaptchaContainerId === containerId) {
    logPhoneAuthEvent("debug", "reuse window.recaptchaVerifier", { containerId });
    return existing;
  }

  if (existing && window.__phoneRecaptchaContainerId !== containerId) {
    logPhoneAuthEvent("info", "recaptcha container id changed; resetting verifier", {
      previous: window.__phoneRecaptchaContainerId,
      next: containerId
    });
    resetPhoneRecaptchaVerifier();
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => logPhoneAuthEvent("debug", "recaptcha callback (invisible)"),
    "expired-callback": () => {
      logPhoneAuthEvent("warn", "recaptcha expired; reset recommended");
      resetPhoneRecaptchaVerifier();
    }
  });

  window.recaptchaVerifier = verifier;
  window.__phoneRecaptchaContainerId = containerId;
  logPhoneAuthEvent("info", "RecaptchaVerifier constructed", { containerId });

  try {
    await verifier.render();
    logPhoneAuthEvent("debug", "RecaptchaVerifier.render() done");
  } catch (e) {
    logPhoneAuthEvent("warn", "RecaptchaVerifier.render() threw", {
      message: e instanceof Error ? e.message : String(e)
    });
  }

  return verifier;
}

/**
 * @deprecated Prefer {@link getOrCreatePhoneRecaptchaVerifier} so `window.recaptchaVerifier` is reused.
 */
export async function createPhoneRecaptchaVerifier(
  auth: Auth,
  containerId: string
): Promise<RecaptchaVerifier> {
  resetPhoneRecaptchaVerifier();
  return getOrCreatePhoneRecaptchaVerifier(auth, containerId);
}
