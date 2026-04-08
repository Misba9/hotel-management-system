import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function serviceAccountCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase-admin] Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY for the service account."
    );
  }

  return cert({ projectId, clientEmail, privateKey });
}

const adminApp =
  getApps().length > 0 ? getApp() : initializeApp({ credential: serviceAccountCredential() });

export const adminAuth: Auth = getAuth(adminApp);
