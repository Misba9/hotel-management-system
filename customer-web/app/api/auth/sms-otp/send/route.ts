import { createHash, randomInt } from "crypto";
import twilio from "twilio";
import { z } from "zod";
import { adminDb } from "../../../../../../backend/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";
import { isValidE164, normalizePhoneE164 } from "@shared/utils/phone-e164";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24)
});

const OTP_TTL_MS = 5 * 60_000;
const COLLECTION = "otp_sms";

function phoneKey(phoneE164: string): string {
  return createHash("sha256").update(phoneE164).digest("hex");
}

function otpHash(phoneE164: string, otp: string): string {
  const secret =
    process.env.SMS_OTP_SECRET ||
    process.env.WHATSAPP_OTP_SECRET ||
    process.env.ADMIN_SDK_PRIVATE_KEY ||
    "fallback-otp-secret";
  return createHash("sha256").update(`${phoneE164}:${otp}:${secret}`).digest("hex");
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  return twilio(sid, token);
}

function getSmsFromNumber(): string {
  const from =
    process.env.TWILIO_SMS_FROM ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    throw new Error("Twilio SMS sender is not configured. Set TWILIO_SMS_FROM.");
  }
  // Allow values like "whatsapp:+1..." to be reused incorrectly — strip whatsapp: prefix if present.
  return from.replace(/^whatsapp:/i, "");
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "sms_otp_send", limit: 8, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }
    const phoneE164 = normalizePhoneE164(parsed.data.phone);
    if (!isValidE164(phoneE164)) {
      return Response.json({ ok: false, error: "Invalid phone number." }, { status: 400 });
    }

    const otp = String(randomInt(100000, 999999));
    const codeHash = otpHash(phoneE164, otp);
    const key = phoneKey(phoneE164);
    const expiresAtMs = Date.now() + OTP_TTL_MS;

    await adminDb.collection(COLLECTION).doc(key).set(
      {
        phone: phoneE164,
        codeHash,
        attempts: 0,
        used: false,
        expiresAtMs,
        updatedAt: Date.now()
      },
      { merge: true }
    );

    const client = getTwilioClient();
    await client.messages.create({
      body: `Your Nausheen Fruits verification code is ${otp}. It expires in 5 minutes.`,
      from: getSmsFromNumber(),
      to: phoneE164
    });

    return Response.json({ ok: true, channel: "sms" }, { status: 200 });
  } catch (e) {
    console.error("[api/auth/sms-otp/send] failed", e);
    const message = e instanceof Error ? e.message : "Could not send SMS OTP.";
    const isConfig = /Twilio|TWILIO|not configured/i.test(message);
    return Response.json(
      { ok: false, error: isConfig ? "SMS is not configured on the server." : "Could not send SMS OTP." },
      { status: isConfig ? 503 : 500 }
    );
  }
}
