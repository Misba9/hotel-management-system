import { requireAdmin } from "@shared/utils/admin-api-auth";
import { captureApiError } from "@shared/utils/monitoring";
import { z } from "zod";

const payloadSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(10000).optional(),
  page: z.string().max(500).optional(),
  userAgent: z.string().max(1000).optional()
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_monitoring_error", limit: 20, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const error = new Error(parsed.data.message);
  error.stack = parsed.data.stack;
  await captureApiError({
    service: "admin-dashboard",
    route: "/api/monitoring/error",
    error,
    context: {
      page: parsed.data.page ?? "",
      userAgent: parsed.data.userAgent ?? ""
    }
  });

  return Response.json({ success: true }, { status: 200 });
}
