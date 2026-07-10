/**
 * User-facing messages for Firebase Auth error codes (popup, phone, email, etc.).
 * Always logs `code` + `message` for debugging.
 */

export function getAuthErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "");
  }
  return "";
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message ?? "");
  }
  return "";
}

export function logFirebaseAuthError(error: unknown, context: string): void {
  const code = getAuthErrorCode(error);
  const message = getAuthErrorMessage(error);
  // Lazy import avoided — callers that need full diagnostics call logFirebaseDiagnostics separately.
  console.error(`[Firebase Auth] ${context}`, {
    code: code || "(none)",
    message: message || String(error)
  });
}

export function mapFirebaseAuthError(error: unknown, context: string): string {
  logFirebaseAuthError(error, context);

  const message = getAuthErrorMessage(error);
  if (/redirect_uri_mismatch/i.test(message)) {
    return (
      "Google Error 400 redirect_uri_mismatch — this is a Google Cloud OAuth client setting, not Firebase Console Auth. " +
      "Open Google Cloud Console → APIs & Services → Credentials → the Web client used by Firebase " +
      "(often “Web client (auto created by Google Service)” or client ending in …apps.googleusercontent.com) → " +
      "Authorized redirect URIs → add EXACTLY: https://nausheen-fruits-new.firebaseapp.com/__/auth/handler " +
      "Then wait 1–5 minutes and retry. Do not add your brand domain as redirect_uri unless Custom Auth Domain is configured."
    );
  }

  const code = getAuthErrorCode(error);
  switch (code) {
    case "auth/invalid-api-key":
      return "Invalid Firebase API key. Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local and restart the dev server.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add localhost (and your production domain).";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed before completing. Try again and finish the Google prompt.";
    case "auth/cancelled-popup-request":
      return "Another sign-in popup was already open. Close it and try again.";
    case "auth/popup-blocked":
      return "Pop-up was blocked by the browser. Allow pop-ups for this site and try again.";
    case "auth/invalid-credential":
      return "Invalid OAuth credential. Verify Firebase config values and ensure your current domain is listed in Firebase Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email using a different sign-in method. Sign in with that method, then link Google in account settings.";
    case "auth/network-request-failed":
      return `Network request failed [${code}]. Check your internet connection, disable VPN/ad-blockers briefly, and try again.`;
    case "auth/operation-not-supported-in-this-environment":
      return "This sign-in method is not supported in the current browser environment. Try a different browser or disable private/strict tracking mode.";
    case "auth/internal-error":
      return "Firebase internal error during sign-in. Confirm Google provider is enabled, Identity Toolkit API is on, and authDomain matches your Firebase project.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Wait a few minutes and try again.";
    case "auth/web-storage-unsupported":
      return "Browser storage is disabled. Enable cookies/local storage for this site and try again.";
    case "unavailable":
      return `Firestore unavailable [${code}]: ${message || "client may be offline"}. Check network and Firebase project.`;
    default:
      break;
  }

  if (message) return code ? `${message} [${code}]` : message;
  return context;
}
