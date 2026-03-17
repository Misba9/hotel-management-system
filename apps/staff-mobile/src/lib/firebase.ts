import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: env.EXPO_PUBLIC_FIREBASE_DATABASE_URL
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const staffDb = getFirestore(app);
export const staffRtdb = getDatabase(app);
export const staffFunctions = getFunctions(app);
