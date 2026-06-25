import { adminDb } from "@shared/firebase/admin";
import type { IntegrationId, IntegrationSyncLogStatus } from "@shared/types/integrations";

const SYNC_LOGS_COLLECTION = "integration_sync_logs";

export async function appendIntegrationSyncLog(input: {
  integrationId: IntegrationId;
  service: string;
  event: string;
  status: IntegrationSyncLogStatus;
}): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection(SYNC_LOGS_COLLECTION).doc().set({
    integrationId: input.integrationId,
    service: input.service,
    event: input.event,
    status: input.status,
    createdAt: now
  });

  await adminDb.collection("integrations").doc(input.integrationId).set(
    {
      lastSyncAt: now,
      lastSyncStatus: input.status,
      updatedAt: now
    },
    { merge: true }
  );
}
