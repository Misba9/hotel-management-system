/**
 * Auth (RN persistence) + Firestore db from `src/services/firebase.ts`.
 *
 * Import order matters: firebaseApp must be created before initializeAuth so
 * Auth registers against the same @firebase/app singleton (see metro.config.js).
 *
 * `getReactNativePersistence` is RN-only and not in the web `firebase/auth` typings,
 * so it is loaded via a typed require (same pattern as staff-mobile).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getAuth, initializeAuth, type Persistence } from "firebase/auth";
import { firebaseApp, firestoreDb } from "../services/firebase";

const { getReactNativePersistence } = require("firebase/auth") as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

function initCustomerAuth() {
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
    throw error;
  }
}

export const auth = initCustomerAuth();
export { firestoreDb as db };
