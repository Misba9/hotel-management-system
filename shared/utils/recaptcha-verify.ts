/**
 * Server-side verification for Google reCAPTCHA v3 (siteverify).
 * @see https://developers.google.com/recaptcha/docs/v3
 */
export type RecaptchaV3VerifyResult =
  | { ok: true; score: number; action: string }
  | { ok: false; reason: "invalid" | "low_score" | "action_mismatch" | "config" };

export async function verifyRecaptchaV3Token(
  token: string,
  expectedAction: string,
): Promise<RecaptchaV3VerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "config" };
    }
    console.warn("[recaptcha] RECAPTCHA_SECRET_KEY missing — skipping verification (non-production only).");
    return { ok: true, score: 1, action: expectedAction };
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as {
    success?: boolean;
    score?: number;
    action?: string;
    "error-codes"?: string[];
  };

  if (!data.success) {
    return { ok: false, reason: "invalid" };
  }

  const action = data.action ?? "";
  if (expectedAction && action !== expectedAction) {
    return { ok: false, reason: "action_mismatch" };
  }

  const score = typeof data.score === "number" ? data.score : 0;
  if (score < 0.5) {
    return { ok: false, reason: "low_score" };
  }

  return { ok: true, score, action: action || expectedAction };
}
