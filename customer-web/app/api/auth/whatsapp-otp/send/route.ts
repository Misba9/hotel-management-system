import { randomInt, createHash } from "crypto";
import twilio from "twilio";
import { z } from "zod";
import { adminDb } from "../../../../../../backend/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24)
});

const OTP_TTL_MS = 5 * 60_000;

function normalizeE164(raw: string): string {
  const input = raw.trim().replace(/\s/g, "");
  if (input.startsWith("+")) return input;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function phoneKey(phoneE164: string): string {
  return createHash("sha256").update(phoneE164).digest("hex");
}

function otpHash(phoneE164: string, otp: string): string {
  const secret = process.env.WHATSAPP_OTP_SECRET || process.env.FIREBASE_PRIVATE_KEY || "fallback-otp-secret";
  return createHash("sha256")
    .update(`${phoneE164}:${otp}:${secret}`)
    .digest("hex");
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  return twilio(sid, token);
}

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "whatsapp_otp_send", limit: 8, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }
    const phoneE164 = normalizeE164(parsed.data.phone);
    if (!/^\+\d{8,15}$/.test(phoneE164)) {
      return Response.json({ ok: false, error: "Invalid phone number." }, { status: 400 });
    }

    const otp = String(randomInt(100000, 999999));
    const codeHash = otpHash(phoneE164, otp);
    const key = phoneKey(phoneE164);
    const expiresAtMs = Date.now() + OTP_TTL_MS;

    await adminDb.collection("otp_fallback_whatsapp").doc(key).set(
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

    const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
    const client = getTwilioClient();
    await client.messages.create({
      body: `Your OTP is ${otp}. It expires in 5 minutes.`,
      from,
      to: `whatsapp:${phoneE164}`
    });

    return Response.json({ ok: true, channel: "whatsapp" }, { status: 200 });
  } catch (e) {
    console.error("[api/auth/whatsapp-otp/send] failed", e);
    return Response.json({ ok: false, error: "Could not send WhatsApp OTP." }, { status: 500 });
  }
}
