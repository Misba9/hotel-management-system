import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

const REQUIRED_SERVICE_ACCOUNT_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY"
] as const;

type RequiredServiceEnvKey = (typeof REQUIRED_SERVICE_ACCOUNT_ENV)[number];

/** Read at call time so Next.js does not bake runtime-only Cloud env vars into the server bundle. */
function readRuntimeEnv(name: string): string | undefined {
  return process.env[name];
}

function hasServiceAccountEnv(): boolean {
  return REQUIRED_SERVICE_ACCOUNT_ENV.every((key) => Boolean(readRuntimeEnv(key)?.trim()));
}

function getMissingServiceAccountEnv(): RequiredServiceEnvKey[] {
  return REQUIRED_SERVICE_ACCOUNT_ENV.filter((key) => !readRuntimeEnv(key)?.trim());
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
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
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
  const storageBucket = sanitizeBucket(
    process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );
  return {
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {})
  };
}

function initializeWithServiceAccount(): App {
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    }),
    ...getAppInitOptions()
  });
}

function initializeWithRuntimeCredentials(): App {
  return initializeApp(getAppInitOptions());
}

function createMissingEnvError(missing: RequiredServiceEnvKey[]): Error {
  return new Error(
    `[firebase-admin] Missing required env vars: ${missing.join(", ")}. ` +
      "Provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
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
              "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
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
