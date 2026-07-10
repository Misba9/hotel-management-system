import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function readFirst(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function serviceAccountCredential() {
  // Prefer ADMIN_SDK_* — FIREBASE_* is reserved by Firebase frameworks .env loader.
  const projectId = readFirst("ADMIN_SDK_PROJECT_ID", "FIREBASE_PROJECT_ID");
  const clientEmail = readFirst("ADMIN_SDK_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL");
  const privateKey = readFirst("ADMIN_SDK_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase-admin] Set ADMIN_SDK_PROJECT_ID, ADMIN_SDK_CLIENT_EMAIL, and ADMIN_SDK_PRIVATE_KEY for the service account."
    );
  }

  return cert({ projectId, clientEmail, privateKey });
}

const adminApp =
  getApps().length > 0 ? getApp() : initializeApp({ credential: serviceAccountCredential() });

export const adminAuth: Auth = getAuth(adminApp);
