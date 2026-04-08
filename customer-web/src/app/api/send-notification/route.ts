import { adminMessaging, getFirebaseAdminApp } from "@shared/firebase/admin";
import { consumeRateLimit, enforceApiSecurity } from "@shared/utils/api-security";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1).max(4096),
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional()
});

/**
 * Sends a single FCM notification to a device token (Firebase Admin).
 * Auth: Bearer ID token with role `admin` or `manager`, or `X-Internal-Secret` when
 * `INTERNAL_SEND_NOTIFICATION_SECRET` is set (server-to-server / Functions).
 */
export async function POST(request: Request) {
  const internalSecret = process.env.INTERNAL_SEND_NOTIFICATION_SECRET?.trim();
  const isInternal =
    Boolean(internalSecret) && request.headers.get("x-internal-secret") === internalSecret;

  if (!isInternal) {
    const secure = await enforceApiSecurity(request, {
      roles: ["admin", "manager"],
      rateLimit: { keyPrefix: "send_notification", limit: 120, windowMs: 60_000 }
    });
    if (!secure.ok) return secure.response;
  } else if (
    consumeRateLimit(request, {
      keyPrefix: "send_notification_internal",
      limit: 120,
      windowMs: 60_000
    })
  ) {
    return Response.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  if (!getFirebaseAdminApp()) {
    return Response.json(
      { success: false, error: "Firebase Admin is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const text = body.body ?? "";
    const messageId = await adminMessaging.send({
      token: body.token,
      notification: { title: body.title, body: text }
    });
    return Response.json({ success: true, messageId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid payload." }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[send-notification]", error);
    }
    return Response.json({ success: false, error: "Failed to send notification." }, { status: 500 });
  }
}
