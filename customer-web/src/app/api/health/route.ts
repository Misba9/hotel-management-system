import { adminAuth, adminDb, adminMessaging } from "@shared/firebase/admin";
import { adminRtdb } from "@shared/firebase/rtdb-admin";

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

function hasAdminEnv() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_DATABASE_URL
  );
}

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

  if (!hasAdminEnv()) {
    result.status = "degraded";
    result.database = "not_configured";
    result.auth = "not_configured";
    result.realtime = "not_configured";
    result.messaging = "not_configured";
    result.functions = "not_configured";
    details.config =
      "Missing FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_DATABASE_URL in server env.";
    return Response.json(result, { status: 200 });
  }

  try {
    await adminDb.collection("branches").limit(1).get();
    result.database = "connected";
  } catch (error) {
    result.status = "degraded";
    result.database = "error";
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
    await adminRtdb.ref("health_check/ping").get();
    result.realtime = "connected";
  } catch (error) {
    result.status = "degraded";
    result.realtime = "error";
    details.realtime = error instanceof Error ? error.message : "Unknown Realtime DB error";
  }

  try {
    // If messaging app instance exists and SDK is initialized, consider FCM configured.
    // End-to-end send requires a real device token, so this is a readiness check.
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
