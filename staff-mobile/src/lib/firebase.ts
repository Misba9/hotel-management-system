/**
 * Auth (RN persistence) + Firestore db from `src/services/firebase.ts`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import type { Persistence } from "firebase/auth";
import { firebaseApp, firestoreDb } from "../services/firebase";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require("firebase/auth") as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

function initStaffAuth() {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }
  try {
    if (typeof getReactNativePersistence !== "function") {
      return getAuth(firebaseApp);
    }
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already-initialized/i.test(message)) {
      return getAuth(firebaseApp);
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[staffAuth] initializeAuth failed, falling back to getAuth:", message);
    }
    return getAuth(firebaseApp);
  }
}

export const staffAuth = initStaffAuth();
export const staffDb = firestoreDb;
export const db = firestoreDb;
export const staffFunctions = getFunctions(firebaseApp);
