import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay signs the **raw** webhook body (string). Use `request.text()` before `JSON.parse`.
 * Header: `x-razorpay-signature` (lowercase in Fetch API).
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!webhookSecret || !signatureHeader?.trim()) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
