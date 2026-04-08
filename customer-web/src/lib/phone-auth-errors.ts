/**
 * User-facing copy for Firebase phone auth (send + verify OTP).
 */
export function mapPhoneAuthError(error: unknown, phase: "send" | "verify"): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code);
    switch (code) {
      case "auth/invalid-verification-code":
        return "That code doesn’t match. Check the SMS and try again.";
      case "auth/code-expired":
        return "This code has expired. Tap Resend OTP for a new one.";
      case "auth/session-expired":
        return "Session timed out. Resend OTP to continue.";
      case "auth/invalid-verification-id":
        return "Verification expired. Resend OTP.";
      case "auth/missing-verification-code":
        return "Enter all 6 digits.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
      case "auth/invalid-phone-number":
        return "Invalid phone number. Use E.164 format (e.g. +91 9876543210).";
      case "auth/quota-exceeded":
        return "SMS quota exceeded for this project. Try again later or check Firebase billing.";
      case "auth/captcha-check-failed":
      case "auth/missing-app-credential":
        return "Security check (reCAPTCHA) failed. Refresh the page and try Send OTP again.";
      case "auth/invalid-api-key":
        return "Invalid API key. Set NEXT_PUBLIC_FIREBASE_API_KEY in .env.local. In Google Cloud → APIs & Services → Credentials, ensure the key is not over-restricted, or create a Browser key with http://localhost:* allowed.";
      case "auth/unauthorized-domain":
        return "This domain is not allowed. Firebase Console → Authentication → Settings → Authorized domains → add localhost (and your production host).";
      case "auth/operation-not-allowed":
        return "Phone sign-in is disabled. Firebase Console → Authentication → Sign-in method → enable Phone.";
      case "auth/app-not-authorized":
        return "This API key isn’t allowed to call Firebase Auth. Enable the Identity Toolkit API in Google Cloud Console for this project, and relax API key restrictions (or add localhost referrers) for local development.";
      case "auth/internal-error":
        return "Firebase internal error. Enable Identity Toolkit API, verify billing, and check Phone Auth is enabled in Firebase Console.";
      case "auth/invalid-app-credential":
        return "App credential invalid. Confirm reCAPTCHA / SafetyNet setup and that Phone auth is enabled.";
      default:
        break;
    }
  }
  if (error instanceof Error) {
    if (phase === "verify" && /invalid/i.test(error.message)) {
      return "Invalid OTP. Try again or request a new code.";
    }
    return error.message;
  }
  return phase === "send" ? "Could not send OTP." : "Could not verify OTP.";
}
