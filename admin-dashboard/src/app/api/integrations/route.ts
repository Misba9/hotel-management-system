import { requireAdmin } from "@shared/utils/admin-api-auth";
import { z } from "zod";
import {
  IntegrationConfigError,
  listIntegrationSyncLogs,
  listIntegrations,
  patchIntegration,
  seedIntegrationsFromEnv
} from "@/lib/integrations-server";
import { INTEGRATION_CATALOG, type IntegrationId } from "@shared/types/integrations";

const integrationIds = INTEGRATION_CATALOG.map((c) => c.id) as [IntegrationId, ...IntegrationId[]];

const patchSchema = z.object({
  id: z.enum(integrationIds),
  enabled: z.boolean()
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_integrations_get", limit: 120, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    await seedIntegrationsFromEnv();
    const [integrations, logs] = await Promise.all([listIntegrations(), listIntegrationSyncLogs(50)]);
    return Response.json({ integrations, logs }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Integrations GET error:", error);
    }
    return Response.json({ error: "Failed to fetch integrations." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request, {
    rateLimit: { keyPrefix: "admin_integrations_patch", limit: 40, windowMs: 60_000 }
  });
  if (!auth.ok) return auth.response;

  try {
    const body = patchSchema.parse(await request.json());
    const integration = await patchIntegration(body.id, { enabled: body.enabled });
    return Response.json({ integration }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    }
    if (error instanceof IntegrationConfigError) {
      return Response.json(
        { error: error.message, missingEnv: error.missingEnv },
        { status: 422 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("Integrations PATCH error:", error);
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update integration." },
      { status: 500 }
    );
  }
}
