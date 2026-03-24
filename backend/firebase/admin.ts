import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

const REQUIRED_SERVICE_ACCOUNT_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY"
] as const;

type RequiredServiceEnvKey = (typeof REQUIRED_SERVICE_ACCOUNT_ENV)[number];

function getMissingServiceAccountEnv(): RequiredServiceEnvKey[] {
  return REQUIRED_SERVICE_ACCOUNT_ENV.filter((key) => !process.env[key]);
}

function shouldUseRuntimeDefaultCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      process.env.FUNCTION_TARGET ||
      process.env.FUNCTIONS_EMULATOR
  );
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

let cachedInitErrorMessage = "";

function initializeAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const missing = getMissingServiceAccountEnv();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (missing.length === 0) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      }),
      ...(databaseURL ? { databaseURL } : {})
    });
  }

  const missingEnvError = createMissingEnvError(missing);
  if (!shouldUseRuntimeDefaultCredentials()) {
    throw missingEnvError;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`${missingEnvError.message} Falling back to runtime default credentials.`);
  }

  return initializeApp({
    ...(databaseURL ? { databaseURL } : {})
  });
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

const app = getAdminAppSafely();

export const adminDb: Firestore = app
  ? getFirestore(app)
  : createLazyServiceProxy<Firestore>("Firestore", (adminApp) => getFirestore(adminApp));
export const adminAuth: Auth = app
  ? getAuth(app)
  : createLazyServiceProxy<Auth>("Auth", (adminApp) => getAuth(adminApp));
export const adminRtdb: Database = app
  ? getDatabase(app)
  : createLazyServiceProxy<Database>("Realtime Database", (adminApp) => getDatabase(adminApp));
export const adminMessaging: Messaging = app
  ? getMessaging(app)
  : createLazyServiceProxy<Messaging>("Messaging", (adminApp) => getMessaging(adminApp));
