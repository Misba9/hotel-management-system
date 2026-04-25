import { enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Accepts anonymized OTP flow diagnostics from the client (no phone numbers).
 * Logs server-side so Vercel / hosting logs show failures when Identity Toolkit / reCAPTCHA misconfigure.
 */
const bodySchema = z.object({
  phase: z.enum(["send", "verify", "recaptcha"]),
  firebaseErrorCode: z.string().max(80).optional(),
  message: z.string().max(500).optional(),
  page: z.string().max(200).optional()
});

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "otp_client_log", limit: 40, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }
    const { phase, firebaseErrorCode, message, page } = parsed.data;
    console.error(
      JSON.stringify({
        tag: "customer-web/otp-log",
        phase,
        firebaseErrorCode: firebaseErrorCode ?? null,
        message: message ?? null,
        page: page ?? null,
        ts: new Date().toISOString()
      })
    );
    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[api/auth/otp-log] failed", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
