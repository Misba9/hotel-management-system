import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";
import { runIntegrationSync } from "@/lib/integrations-server";
import { INTEGRATION_CATALOG, type IntegrationId } from "@shared/types/integrations";

const integrationIds = INTEGRATION_CATALOG.map((c) => c.id) as [IntegrationId, ...IntegrationId[]];

const syncSchema = z.object({
  id: z.enum(integrationIds)
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_integrations_sync", limit: 30, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const body = syncSchema.parse(await request.json());
    const result = await runIntegrationSync(body.id);
    return Response.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Integrations sync error:", error);
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 500 }
    );
  }
}
