import { handleEmailPasswordAuthPostWithDefaultAdmin } from "@shared/utils/email-password-auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleEmailPasswordAuthPostWithDefaultAdmin(request, {
    allowedModes: ["login", "signup"],
    rateLimitKeyPrefix: "customer_email_auth"
  });
}
