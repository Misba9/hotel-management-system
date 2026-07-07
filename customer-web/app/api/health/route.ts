import { adminAuth, adminDb, adminMessaging, getFirebaseAdminApp } from "@shared/firebase/admin";

export const dynamic = "force-dynamic";

type ServiceStatus = "connected" | "working" | "reachable" | "configured" | "error" | "not_configured";

type HealthPayload = {
  status: "running" | "degraded";
  database: ServiceStatus;
  auth: ServiceStatus;
  functions: ServiceStatus;
  realtime: ServiceStatus;
  messaging: ServiceStatus;
  details: Record<string, string>;
};

export async function GET() {
  const details: Record<string, string> = {};
  const result: HealthPayload = {
    status: "running",
    database: "error",
    auth: "error",
    functions: "error",
    realtime: "error",
    messaging: "error",
    details
  };

  if (!getFirebaseAdminApp()) {
    result.status = "degraded";
    result.database = "not_configured";
    result.auth = "not_configured";
    result.realtime = "not_configured";
    result.messaging = "not_configured";
    result.functions = "not_configured";
    details.config =
      "Firebase Admin SDK is not initialized. On Cloud Functions this should use runtime credentials; locally set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.";
    return Response.json(result, { status: 200 });
  }

  try {
    await adminDb.collection("branches").limit(1).get();
    result.database = "connected";
    result.realtime = "connected";
  } catch (error) {
    result.status = "degraded";
    result.database = "error";
    result.realtime = "error";
    details.database = error instanceof Error ? error.message : "Unknown Firestore error";
  }

  try {
    await adminAuth.listUsers(1);
    result.auth = "working";
  } catch (error) {
    result.status = "degraded";
    result.auth = "error";
    details.auth = error instanceof Error ? error.message : "Unknown Auth error";
  }

  try {
    const appName = adminMessaging.app.name;
    result.messaging = appName ? "configured" : "error";
  } catch (error) {
    result.status = "degraded";
    result.messaging = "error";
    details.messaging = error instanceof Error ? error.message : "Unknown Messaging error";
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID not set");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/healthCheck`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    result.functions = res.ok ? "reachable" : "error";
    if (!res.ok) {
      result.status = "degraded";
      details.functions = `healthCheck responded ${res.status}`;
    }
  } catch (error) {
    result.status = "degraded";
    result.functions = "error";
    details.functions = error instanceof Error ? error.message : "Unknown Cloud Functions error";
  }

  return Response.json(result, { status: 200 });
}
