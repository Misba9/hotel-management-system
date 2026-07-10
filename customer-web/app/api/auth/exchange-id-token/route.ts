import { z } from "zod";
import { adminAuth } from "@shared/firebase/admin";
import { enforceApiSecurity } from "@shared/utils/api-security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(20).max(4096)
});

/**
 * Exchanges a Firebase ID token (from web Google/Apple popup) for a custom token
 * so customer-mobile can finish sign-in via signInWithCustomToken.
 */
export async function POST(request: Request) {
  const secure = await enforceApiSecurity(request, {
    rateLimit: { keyPrefix: "exchange_id_token", limit: 30, windowMs: 60_000 }
  });
  if (!secure.ok) return secure.response;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
    if (!decoded.uid) {
      return Response.json({ ok: false, error: "Invalid ID token." }, { status: 401 });
    }

    const customToken = await adminAuth.createCustomToken(decoded.uid);
    return Response.json({ ok: true, customToken }, { status: 200 });
  } catch (e) {
    console.error("[api/auth/exchange-id-token] failed", e);
    return Response.json(
      { ok: false, error: "Could not exchange sign-in token. Ensure Google/Apple is enabled in Firebase." },
      { status: 401 }
    );
  }
}
