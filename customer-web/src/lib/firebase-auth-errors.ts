/**
 * User-facing messages for Firebase Auth error codes (popup, phone, email, etc.).
 */
export function mapFirebaseAuthError(error: unknown, context: string): string {
  if (error instanceof Error && /redirect_uri_mismatch/i.test(error.message)) {
    return "Google OAuth redirect URI mismatch. In Google Cloud Console, add your exact Firebase auth handler URL to Authorized redirect URIs (for example: https://<your-auth-domain>/__/auth/handler).";
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    switch (code) {
      case "auth/invalid-api-key":
        return "Invalid Firebase API key. Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local and restart the dev server.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add localhost (and your production domain).";
      case "auth/operation-not-allowed":
        return "This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Sign-in was cancelled.";
      case "auth/popup-blocked":
        return "Pop-up was blocked. Allow pop-ups for this site and try again.";
      case "auth/invalid-credential":
        return "Invalid OAuth credential. Verify Firebase config values and ensure your current domain is listed in Firebase Authorized domains.";
      case "auth/account-exists-with-different-credential":
        return "An account already exists with the same email using a different sign-in method. Use that method or link accounts in Firebase.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        break;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return context;
}
