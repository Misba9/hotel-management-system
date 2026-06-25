import {getFirestore} from "firebase-admin/firestore";

type IntegrationSyncLogStatus = "success" | "error" | "warning";

async function appendIntegrationSyncLog(input: {
  integrationId: string;
  service: string;
  event: string;
  status: IntegrationSyncLogStatus;
}): Promise<void> {
  const db = getFirestore();
  const now = new Date().toISOString();
  await db.collection("integration_sync_logs").doc().set({
    integrationId: input.integrationId,
    service: input.service,
    event: input.event,
    status: input.status,
    createdAt: now
  });
  await db.collection("integrations").doc(input.integrationId).set(
    {
      lastSyncAt: now,
      lastSyncStatus: input.status,
      updatedAt: now
    },
    {merge: true}
  );
}

export {appendIntegrationSyncLog};
