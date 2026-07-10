import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

/**
 * Service-account env names.
 * Do NOT use the FIREBASE_ prefix — Firebase Hosting / Cloud Functions rejects
 * keys starting with FIREBASE_, X_GOOGLE_, or EXT_ when loading .env for frameworks.
 */
const SERVICE_ACCOUNT_ENV = {
  projectId: ["ADMIN_SDK_PROJECT_ID", "FIREBASE_PROJECT_ID"],
  clientEmail: ["ADMIN_SDK_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL"],
  privateKey: ["ADMIN_SDK_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY"],
  storageBucket: ["ADMIN_SDK_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"]
} as const;

/** Read at call time so Next.js does not bake runtime-only Cloud env vars into the server bundle. */
function readRuntimeEnv(name: string): string | undefined {
  return process.env[name];
}

function readFirstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = readRuntimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function hasServiceAccountEnv(): boolean {
  return Boolean(
    readFirstEnv(SERVICE_ACCOUNT_ENV.projectId) &&
      readFirstEnv(SERVICE_ACCOUNT_ENV.clientEmail) &&
      readFirstEnv(SERVICE_ACCOUNT_ENV.privateKey)
  );
}

function getMissingServiceAccountEnv(): string[] {
  const missing: string[] = [];
  if (!readFirstEnv(SERVICE_ACCOUNT_ENV.projectId)) missing.push("ADMIN_SDK_PROJECT_ID");
  if (!readFirstEnv(SERVICE_ACCOUNT_ENV.clientEmail)) missing.push("ADMIN_SDK_CLIENT_EMAIL");
  if (!readFirstEnv(SERVICE_ACCOUNT_ENV.privateKey)) missing.push("ADMIN_SDK_PRIVATE_KEY");
  return missing;
}

function shouldUseRuntimeDefaultCredentials(): boolean {
  const runtimeKeys = [
    "GOOGLE_APPLICATION_CREDENTIALS",
    "K_SERVICE",
    "K_CONFIGURATION",
    "FUNCTION_TARGET",
    "FUNCTIONS_EMULATOR",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_CONFIG"
  ];
  return runtimeKeys.some((key) => Boolean(readRuntimeEnv(key)));
}

function getExistingApp(): App | null {
  const apps = getApps();
  if (apps.length === 0) return null;
  try {
    return getApp();
  } catch {
    return apps[0] ?? null;
  }
}

function getRuntimeProjectId(): string | undefined {
  const fromAdmin = readFirstEnv(SERVICE_ACCOUNT_ENV.projectId);
  if (fromAdmin) return fromAdmin;
  if (process.env.GCLOUD_PROJECT?.trim()) {
    return process.env.GCLOUD_PROJECT.trim();
  }
  if (process.env.GOOGLE_CLOUD_PROJECT?.trim()) {
    return process.env.GOOGLE_CLOUD_PROJECT.trim();
  }
  const raw = process.env.FIREBASE_CONFIG?.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { projectId?: unknown };
    const projectId = String(parsed.projectId ?? "").trim();
    return projectId || undefined;
  } catch {
    return undefined;
  }
}

function getAppInitOptions() {
  const projectId = getRuntimeProjectId();
  const storageBucket = sanitizeBucket(readFirstEnv(SERVICE_ACCOUNT_ENV.storageBucket));
  return {
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {})
  };
}

function initializeWithServiceAccount(): App {
  return initializeApp({
    credential: cert({
      projectId: readFirstEnv(SERVICE_ACCOUNT_ENV.projectId),
      clientEmail: readFirstEnv(SERVICE_ACCOUNT_ENV.clientEmail),
      privateKey: sanitizePrivateKey(readFirstEnv(SERVICE_ACCOUNT_ENV.privateKey))
    }),
    ...getAppInitOptions()
  });
}

function initializeWithRuntimeCredentials(): App {
  return initializeApp(getAppInitOptions());
}

function createMissingEnvError(missing: string[]): Error {
  return new Error(
    `[firebase-admin] Missing required env vars: ${missing.join(", ")}. ` +
      "Provide ADMIN_SDK_PROJECT_ID, ADMIN_SDK_CLIENT_EMAIL, and ADMIN_SDK_PRIVATE_KEY " +
      "(do not use the FIREBASE_ prefix — reserved by Firebase frameworks deploy)."
  );
}

function sanitizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, "\n");
}

function sanitizeBucket(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^gs:\/\//i, "").split("/")[0].trim();
  return cleaned || undefined;
}

let cachedInitErrorMessage = "";

function initializeAdminApp(): App {
  const existing = getExistingApp();
  if (existing) return existing;

  const useRuntimeCredentials = shouldUseRuntimeDefaultCredentials();

  if (useRuntimeCredentials) {
    try {
      return initializeWithRuntimeCredentials();
    } catch (runtimeError) {
      if (!hasServiceAccountEnv()) throw runtimeError;
      console.warn(
        "[firebase-admin] Runtime credentials failed; retrying with service-account env vars.",
        runtimeError
      );
    }
  }

  if (hasServiceAccountEnv()) {
    return initializeWithServiceAccount();
  }

  throw createMissingEnvError(getMissingServiceAccountEnv());
}

export function getFirebaseAdminApp(): App | null {
  return getAdminAppSafely();
}

function getAdminAppSafely(): App | null {
  try {
    const app = initializeAdminApp();
    cachedInitErrorMessage = "";
    return app;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!cachedInitErrorMessage || cachedInitErrorMessage !== message) {
      cachedInitErrorMessage = message;
      console.error("[firebase-admin] Failed to initialize Firebase Admin SDK.", error);
    }
    return null;
  }
}

function createLazyServiceProxy<T extends object>(serviceName: string, factory: (app: App) => T): T {
  let cachedService: T | null = null;

  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      if (!cachedService) {
        const app = getAdminAppSafely();
        if (!app) {
          throw new Error(
            `[firebase-admin] ${serviceName} unavailable because Admin SDK is not initialized. ` +
              "Set ADMIN_SDK_PROJECT_ID, ADMIN_SDK_CLIENT_EMAIL, and ADMIN_SDK_PRIVATE_KEY."
          );
        }
        cachedService = factory(app);
      }
      return Reflect.get(cachedService as T, prop, receiver);
    }
  });
}

/** Use for optional lazy-initialized Admin services beyond Firestore. */
export function createLazyAdminService<T extends object>(serviceName: string, factory: (app: App) => T): T {
  return createLazyServiceProxy(serviceName, factory);
}

export const adminDb: Firestore = createLazyServiceProxy<Firestore>("Firestore", (adminApp) =>
  getFirestore(adminApp)
);
export const adminAuth: Auth = createLazyServiceProxy<Auth>("Auth", (adminApp) => getAuth(adminApp));
export const adminMessaging: Messaging = createLazyServiceProxy<Messaging>("Messaging", (adminApp) =>
  getMessaging(adminApp)
);
