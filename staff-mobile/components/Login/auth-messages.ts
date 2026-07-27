import { FirebaseError } from "firebase/app";
import { fetchSignInMethodsForEmail } from "firebase/auth";

import { staffAuth } from "../../src/lib/firebase";

const EXPECTED_AUTH_CODES = new Set([
  "auth/invalid-email",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/network-request-failed",
  "auth/too-many-requests",
  "auth/missing-password",
  "auth/missing-email",
  "auth/operation-not-allowed",
  "auth/internal-error"
]);

export function isExpectedAuthError(err: unknown): boolean {
  return err instanceof FirebaseError && EXPECTED_AUTH_CODES.has(err.code);
}

function isFirebaseError(err: unknown): err is FirebaseError {
  return err instanceof FirebaseError;
}

/**
 * Prefer distinguishing wrong email vs wrong password when Firebase still exposes it.
 * With email-enumeration protection, `invalid-credential` is common for both.
 */
export async function resolveLoginErrorMessage(err: unknown, email: string): Promise<string> {
  if (!isFirebaseError(err)) {
    if (err instanceof Error && err.message.trim()) return err.message;
    return "Sign-in failed.";
  }

  switch (err.code) {
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Invalid email";
    case "auth/user-not-found":
      return "Invalid email — no account found for this address";
    case "auth/wrong-password":
    case "auth/missing-password":
      return "Invalid password";
    case "auth/user-disabled":
      return "Invalid permission — this account has been disabled";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed":
      return "Unable to connect. Please try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled. Contact an administrator.";
    case "auth/invalid-credential": {
      const trimmed = email.trim();
      try {
        const methods = await fetchSignInMethodsForEmail(staffAuth, trimmed);
        if (methods.length === 0) {
          return "Invalid email — no account found for this address";
        }
        return "Invalid password";
      } catch {
        // Enumeration protection often blocks method lookup — fall back to format checks.
        if (looksLikeBadEmailDomain(trimmed)) {
          return "Invalid email — check the address (e.g. .com spelling)";
        }
        return "Invalid email or password — please check both";
      }
    }
    default:
      return err.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[^)]+\)\.?$/, "").trim() ||
        "Sign-in failed.";
  }
}

/** Sync helper for non-login call sites. */
export function friendlyAuthMessage(err: unknown): string {
  if (!isFirebaseError(err)) {
    if (err instanceof Error && err.message.trim()) return err.message;
    return "Login failed.";
  }
  switch (err.code) {
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Invalid email";
    case "auth/user-not-found":
      return "Invalid email — no account found for this address";
    case "auth/wrong-password":
    case "auth/missing-password":
      return "Invalid password";
    case "auth/user-disabled":
      return "Invalid permission — this account has been disabled";
    case "auth/invalid-credential":
      return "Invalid email or password — please check both";
    case "auth/network-request-failed":
      return "Unable to connect. Please try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    default:
      return err.message || "Sign-in failed.";
  }
}

const COMMON_EMAIL_TYPO_TLDS = [
  /\.comc$/i,
  /\.con$/i,
  /\.cpm$/i,
  /\.comm$/i,
  /\.ocm$/i,
  /\.coom$/i,
  /\.gmal\.com$/i,
  /\.gmial\.com$/i,
  /\.gamil\.com$/i
];

export function looksLikeBadEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return true;
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return true;
  return COMMON_EMAIL_TYPO_TLDS.some((re) => re.test(email));
}
