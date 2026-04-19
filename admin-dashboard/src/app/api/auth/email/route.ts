import { handleEmailPasswordAuthPostWithDefaultAdmin } from "@shared/utils/email-password-auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleEmailPasswordAuthPostWithDefaultAdmin(request, {
    allowedModes: ["admin_login"],
    rateLimitKeyPrefix: "admin_email_auth"
  });
}
