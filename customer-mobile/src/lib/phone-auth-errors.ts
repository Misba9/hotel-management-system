/**
 * User-facing copy for phone OTP / Firebase auth errors (mobile).
 */
export function getAuthErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "");
  }
  return "";
}

export function mapPhoneAuthError(error: unknown, phase: "send" | "verify"): string {
  const code = getAuthErrorCode(error);
  switch (code) {
    case "auth/network-request-failed":
      return "Cannot reach the server. Check Wi‑Fi (phone + Mac on same network), that customer-web is running on port 3000, and EXPO_PUBLIC_API_BASE_URL.";
    case "auth/invalid-phone-number":
      return "Invalid phone number. Use E.164 with country code (e.g. +919059899298).";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for this project. Try again later or check Firebase/Twilio billing.";
    case "auth/app-not-authorized":
      return "App not authorized for Auth. Verify google-services.json package name and SHA-1/SHA-256 in Firebase Console.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/internal-error":
      return "Internal auth error. Check Firebase Phone Auth is enabled and server logs.";
    case "auth/missing-client-identifier":
      return "Missing client identifier. Rebuild the app after updating google-services.json.";
    case "auth/invalid-app-credential":
      return "Invalid app credential. Add SHA-1/SHA-256 fingerprints and download a fresh google-services.json.";
    case "auth/captcha-check-failed":
      return "Security check failed. Retry Send OTP.";
    case "auth/invalid-verification-code":
      return "That code doesn’t match. Check the SMS and try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "This code has expired. Tap Resend OTP for a new one.";
    case "auth/operation-not-allowed":
      return "Phone sign-in is disabled. Firebase Console → Authentication → Sign-in method → enable Phone.";
    default:
      break;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  return phase === "send" ? "Could not send OTP." : "Could not verify OTP.";
}

export function logAuthError(label: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.log(`[${label}] Firebase/Auth Error:`, error);
  // eslint-disable-next-line no-console
  console.log(`[${label}] Error Code:`, getAuthErrorCode(error) || "(none)");
  // eslint-disable-next-line no-console
  console.log(
    `[${label}] Error Message:`,
    error instanceof Error ? error.message : String(error)
  );
}
