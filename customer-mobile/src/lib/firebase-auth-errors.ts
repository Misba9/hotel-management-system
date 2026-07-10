/**
 * User-facing messages for Firebase Auth errors on customer-mobile.
 */
export function getAuthErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "");
  }
  return "";
}

export function mapFirebaseAuthError(error: unknown, fallback: string): string {
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
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    default:
      break;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
