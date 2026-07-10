/**
 * User-facing messages for Firebase Auth errors on customer-mobile.
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
  console.error(`[Firebase Auth] ${context}`, { code: code || "(none)", message: message || String(error) });
}

export function mapFirebaseAuthError(error: unknown, fallback: string): string {
  logFirebaseAuthError(error, fallback);

  const message = getAuthErrorMessage(error);
  if (/redirect_uri_mismatch/i.test(message)) {
    return (
      "Google OAuth redirect URI mismatch. Add https://nausheen-fruits-new.firebaseapp.com/__/auth/handler " +
      "to Authorized redirect URIs for the Web client in Google Cloud Console."
    );
  }

  const code = getAuthErrorCode(error);
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email. Sign in instead.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network request failed. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed before completing. Try again.";
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Pop-up was blocked. Allow pop-ups and try again.";
    case "auth/operation-not-supported-in-this-environment":
      return "This sign-in method is not supported in the current environment.";
    case "auth/internal-error":
      return "Firebase internal error during sign-in. Confirm Google is enabled and authDomain is correct.";
    default:
      break;
  }
  if (message) return message;
  return fallback;
}
