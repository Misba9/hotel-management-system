import { createHash } from "crypto";
import { z } from "zod";
import { adminAuth, adminDb } from "../../../../../../backend/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24),
  otp: z.string().regex(/^\d{6}$/)
});

const MAX_ATTEMPTS = 5;

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

export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "whatsapp_otp_verify", limit: 20, windowMs: 60_000 }
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

    const key = phoneKey(phoneE164);
    const ref = adminDb.collection("otp_fallback_whatsapp").doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ ok: false, error: "OTP not found. Request a new code." }, { status: 400 });
    }
    const data = snap.data() as {
      codeHash?: string;
      used?: boolean;
      attempts?: number;
      expiresAtMs?: number;
    };
    const attempts = Number(data.attempts ?? 0);
    if (data.used) {
      return Response.json({ ok: false, error: "OTP already used. Request a new code." }, { status: 400 });
    }
    if (attempts >= MAX_ATTEMPTS) {
      return Response.json({ ok: false, error: "Too many attempts. Request a new code." }, { status: 429 });
    }
    if (!data.expiresAtMs || Date.now() > data.expiresAtMs) {
      return Response.json({ ok: false, error: "OTP expired. Request a new code." }, { status: 400 });
    }

    const expectedHash = otpHash(phoneE164, parsed.data.otp);
    if (!data.codeHash || expectedHash !== data.codeHash) {
      await ref.set({ attempts: attempts + 1, updatedAt: Date.now() }, { merge: true });
      return Response.json({ ok: false, error: "Invalid OTP." }, { status: 400 });
    }

    await ref.set({ used: true, attempts: attempts + 1, verifiedAt: Date.now(), updatedAt: Date.now() }, { merge: true });

    let uid: string;
    try {
      const existing = await adminAuth.getUserByPhoneNumber(phoneE164);
      uid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({ phoneNumber: phoneE164 });
      uid = created.uid;
    }
    const customToken = await adminAuth.createCustomToken(uid);
    return Response.json({ ok: true, customToken }, { status: 200 });
  } catch (e) {
    console.error("[api/auth/whatsapp-otp/verify] failed", e);
    return Response.json({ ok: false, error: "Could not verify OTP." }, { status: 500 });
  }
}
