import { adminDb } from "@shared/firebase/admin";
import {
  INTEGRATION_CATALOG,
  type IntegrationApiRow,
  type IntegrationConnectionStatus,
  type IntegrationDoc,
  type IntegrationId,
  type IntegrationSyncLogStatus
} from "@shared/types/integrations";
import { DEFAULT_POS_SETTINGS, POS_SETTINGS_DOC_ID, type PosSettingsDoc } from "@shared/types/pos-settings";
import { readRazorpayCredentials } from "@shared/lib/razorpay-server";
import { appendIntegrationSyncLog } from "@shared/utils/integration-sync-log";

const INTEGRATIONS_COLLECTION = "integrations";
const SYNC_LOGS_COLLECTION = "integration_sync_logs";

type EnvCheck = { ready: boolean; missing: string[] };

function envTrim(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function checkEnv(keys: string[]): EnvCheck {
  const missing = keys.filter((k) => !envTrim(k));
  return { ready: missing.length === 0, missing };
}

function cloudFunctionsOrigin(): string {
  const explicit = envTrim("NEXT_PUBLIC_CLOUD_FUNCTIONS_ORIGIN") ?? envTrim("CLOUD_FUNCTIONS_ORIGIN");
  if (explicit) return explicit.replace(/\/$/, "");
  const projectId = envTrim("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? envTrim("FIREBASE_PROJECT_ID") ?? "nausheen-fruits-new";
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

function customerWebOrigin(): string {
  return (
    envTrim("NEXT_PUBLIC_CUSTOMER_WEB_URL") ??
    envTrim("CUSTOMER_WEB_URL") ??
    envTrim("NEXT_PUBLIC_APP_URL") ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function credentialsCheck(id: IntegrationId): EnvCheck {
  switch (id) {
    case "swiggy":
      return checkEnv(["SWIGGY_WEBHOOK_SECRET"]);
    case "zomato":
      return checkEnv(["ZOMATO_WEBHOOK_SECRET"]);
    case "ondc":
      return checkEnv(["ONDC_BPP_ID", "ONDC_SIGNING_KEY"]);
    case "razorpay": {
      const creds = readRazorpayCredentials(process.env);
      const missing: string[] = [];
      if (!creds) {
        missing.push("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
      }
      if (!envTrim("RAZORPAY_WEBHOOK_SECRET")) {
        missing.push("RAZORPAY_WEBHOOK_SECRET");
      }
      return { ready: missing.length === 0, missing: [...new Set(missing)] };
    }
    case "phonepe":
      return checkEnv(["PHONEPE_MERCHANT_ID", "PHONEPE_SALT_KEY"]);
    case "stripe":
      return checkEnv(["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"]);
    case "whatsapp":
      return checkEnv(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]);
    case "google_maps":
      return checkEnv(["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);
    default:
      return { ready: false, missing: [] };
  }
}

function webhookUrl(id: IntegrationId): string | null {
  const origin = cloudFunctionsOrigin();
  const customer = customerWebOrigin();
  switch (id) {
    case "swiggy":
      return `${origin}/handleSwiggyWebhook`;
    case "zomato":
      return `${origin}/handleZomatoWebhook`;
    case "razorpay":
      return `${customer}/api/webhook`;
    default:
      return null;
  }
}

function deriveStatus(enabled: boolean, creds: EnvCheck, id: IntegrationId): IntegrationConnectionStatus {
  if (id === "ondc" && !creds.ready) return "pending";
  if (!enabled && !creds.ready) return "disconnected";
  if (enabled && creds.ready) return "connected";
  if (enabled && !creds.ready) return "pending";
  if (!enabled && creds.ready) return "disconnected";
  return "disconnected";
}

export function formatIntegrationSyncLabel(
  lastSyncAt: string | null | undefined,
  status: IntegrationConnectionStatus,
  liveWhenConnected: boolean
): string {
  if (status === "connected" && liveWhenConnected) return "Live";
  if (status === "connected" && !lastSyncAt) return "Active";
  if (!lastSyncAt) return "—";
  const ms = Date.now() - new Date(lastSyncAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

async function loadPosSettings(): Promise<PosSettingsDoc> {
  const snap = await adminDb.collection("settings").doc(POS_SETTINGS_DOC_ID).get();
  if (!snap.exists) return { ...DEFAULT_POS_SETTINGS };
  return { ...DEFAULT_POS_SETTINGS, ...(snap.data() as Partial<PosSettingsDoc>) };
}

async function loadIntegrationDoc(id: IntegrationId): Promise<IntegrationDoc> {
  const snap = await adminDb.collection(INTEGRATIONS_COLLECTION).doc(id).get();
  if (!snap.exists) {
    return { enabled: false };
  }
  const data = snap.data() as Partial<IntegrationDoc>;
  return {
    enabled: Boolean(data.enabled),
    lastSyncAt: data.lastSyncAt,
    lastSyncStatus: data.lastSyncStatus,
    updatedAt: data.updatedAt
  };
}

export async function buildIntegrationRow(id: IntegrationId, pos?: PosSettingsDoc): Promise<IntegrationApiRow> {
  const catalog = INTEGRATION_CATALOG.find((c) => c.id === id)!;
  const doc = await loadIntegrationDoc(id);
  const creds = credentialsCheck(id);
  const settings = pos ?? (await loadPosSettings());

  let status = deriveStatus(doc.enabled, creds, id);

  if (id === "razorpay") {
    if (creds.ready && doc.enabled && settings.paymentProvider === "razorpay") {
      status = "connected";
    } else if (doc.enabled && !creds.ready) {
      status = "pending";
    } else {
      status = "disconnected";
    }
  }

  if (id === "google_maps" && creds.ready) {
    status = doc.enabled || !doc.updatedAt ? "connected" : status;
  }

  return {
    id,
    name: catalog.name,
    category: catalog.category,
    description: catalog.description,
    status,
    enabled: doc.enabled,
    credentialsReady: creds.ready,
    missingEnv: creds.missing,
    lastSyncAt: doc.lastSyncAt ?? null,
    lastSyncLabel: formatIntegrationSyncLabel(doc.lastSyncAt, status, Boolean(catalog.liveWhenConnected)),
    webhookUrl: webhookUrl(id),
    liveWhenConnected: Boolean(catalog.liveWhenConnected)
  };
}

export async function listIntegrations(): Promise<IntegrationApiRow[]> {
  const pos = await loadPosSettings();
  return Promise.all(INTEGRATION_CATALOG.map((c) => buildIntegrationRow(c.id, pos)));
}

export async function patchIntegration(id: IntegrationId, patch: { enabled: boolean }): Promise<IntegrationApiRow> {
  const creds = credentialsCheck(id);
  if (patch.enabled && !creds.ready && id !== "ondc") {
    throw new IntegrationConfigError(
      `Cannot enable ${id}: missing env — ${creds.missing.join(", ")}`,
      creds.missing
    );
  }

  const now = new Date().toISOString();
  await adminDb.collection(INTEGRATIONS_COLLECTION).doc(id).set(
    {
      enabled: patch.enabled,
      updatedAt: now,
      ...(patch.enabled ? {} : { lastSyncStatus: "warning" as IntegrationSyncLogStatus })
    },
    { merge: true }
  );

  if (id === "razorpay" && patch.enabled) {
    await adminDb.collection("settings").doc(POS_SETTINGS_DOC_ID).set(
      { paymentProvider: "razorpay", updatedAt: now },
      { merge: true }
    );
  }
  if (id === "razorpay" && !patch.enabled) {
    await adminDb.collection("settings").doc(POS_SETTINGS_DOC_ID).set(
      { paymentProvider: "manual", updatedAt: now },
      { merge: true }
    );
  }

  await appendIntegrationSyncLog({
    integrationId: id,
    service: INTEGRATION_CATALOG.find((c) => c.id === id)?.name ?? id,
    event: patch.enabled ? "Integration enabled by admin" : "Integration disabled by admin",
    status: patch.enabled ? "success" : "warning"
  });

  return buildIntegrationRow(id);
}

export class IntegrationConfigError extends Error {
  missingEnv: string[];

  constructor(message: string, missingEnv: string[]) {
    super(message);
    this.name = "IntegrationConfigError";
    this.missingEnv = missingEnv;
  }
}

async function countRecentOrdersBySource(source: string): Promise<number> {
  const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(250).get();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return snap.docs.filter((d) => {
    const data = d.data();
    if (String(data.source ?? "").toLowerCase() !== source) return false;
    const created = data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : null);
    if (!created || Number.isNaN(created.getTime())) return true;
    return created.getTime() >= cutoff;
  }).length;
}

export async function runIntegrationSync(id: IntegrationId): Promise<{ message: string; status: IntegrationSyncLogStatus }> {
  const catalog = INTEGRATION_CATALOG.find((c) => c.id === id)!;
  const creds = credentialsCheck(id);
  const doc = await loadIntegrationDoc(id);

  if (!doc.enabled && id !== "google_maps") {
    throw new Error(`${catalog.name} is not enabled. Connect it first.`);
  }

  let message: string;
  let status: IntegrationSyncLogStatus = "success";

  switch (id) {
    case "swiggy": {
      if (!creds.ready) throw new Error("Swiggy webhook secret is not configured.");
      const count = await countRecentOrdersBySource("swiggy");
      message = `Order sync completed — ${count} order${count === 1 ? "" : "s"} in last 24h`;
      break;
    }
    case "zomato": {
      if (!creds.ready) throw new Error("Zomato webhook secret is not configured.");
      const count = await countRecentOrdersBySource("zomato");
      message = `Order sync completed — ${count} order${count === 1 ? "" : "s"} in last 24h`;
      break;
    }
    case "razorpay": {
      const rz = readRazorpayCredentials(process.env);
      if (!rz) throw new Error("Razorpay credentials are not configured.");
      message = "Credentials verified — webhook endpoint ready";
      break;
    }
    case "phonepe": {
      if (!creds.ready) throw new Error("PhonePe credentials are not configured.");
      message = "PhonePe configuration verified";
      break;
    }
    case "stripe": {
      if (!creds.ready) throw new Error("Stripe keys are not configured.");
      message = "Stripe configuration verified";
      break;
    }
    case "whatsapp": {
      if (!creds.ready) throw new Error("Twilio WhatsApp is not configured.");
      message = "WhatsApp (Twilio) configuration verified";
      break;
    }
    case "google_maps": {
      if (!creds.ready) throw new Error("Google Maps API key is not configured.");
      message = "Maps API key present — delivery tracking active";
      break;
    }
    case "ondc": {
      if (!creds.ready) {
        status = "warning";
        message = "ONDC credentials pending — contact support to complete onboarding";
      } else {
        message = "ONDC configuration verified";
      }
      break;
    }
    default:
      message = "Sync completed";
  }

  const now = new Date().toISOString();
  await adminDb.collection(INTEGRATIONS_COLLECTION).doc(id).set(
    { lastSyncAt: now, lastSyncStatus: status, updatedAt: now },
    { merge: true }
  );

  await appendIntegrationSyncLog({
    integrationId: id,
    service: catalog.name,
    event: message,
    status
  });

  return { message, status };
}

export async function listIntegrationSyncLogs(limit = 40) {
  const snap = await adminDb
    .collection(SYNC_LOGS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data() as {
      integrationId?: IntegrationId;
      service?: string;
      event?: string;
      status?: IntegrationSyncLogStatus;
      createdAt?: string;
    };
    return {
      id: d.id,
      integrationId: data.integrationId ?? "razorpay",
      service: data.service ?? "Unknown",
      event: data.event ?? "",
      status: data.status ?? "success",
      createdAt: data.createdAt ?? new Date().toISOString()
    };
  });
}

/** Auto-enable integrations when server env is fully configured (first load). */
export async function seedIntegrationsFromEnv(): Promise<void> {
  const pos = await loadPosSettings();
  for (const item of INTEGRATION_CATALOG) {
    const creds = credentialsCheck(item.id);
    const existing = await loadIntegrationDoc(item.id);
    if (existing.updatedAt) continue;

    const shouldEnable =
      creds.ready &&
      (item.id === "razorpay" ? pos.paymentProvider === "razorpay" : item.id !== "ondc" && item.id !== "stripe");

    if (shouldEnable) {
      await adminDb.collection(INTEGRATIONS_COLLECTION).doc(item.id).set(
        {
          enabled: true,
          updatedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: "success"
        },
        { merge: true }
      );
    }
  }
}
