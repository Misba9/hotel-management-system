/**
 * Best-effort server log for OTP debugging (no PII). Fails silently if offline.
 */
export function reportOtpServerLog(payload: {
  phase: "send" | "verify" | "recaptcha";
  firebaseErrorCode?: string;
  message?: string;
}): void {
  if (typeof window === "undefined") return;
  const page = typeof window.location?.pathname === "string" ? window.location.pathname : "";
  void fetch("/api/auth/otp-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, page })
  }).catch(() => {
    /* ignore */
  });
}
