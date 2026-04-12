/**
 * Auth (RN persistence) + Firestore db from `src/services/firebase.ts`.
 */
import { getAuth, initializeAuth } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getFunctions } from "firebase/functions";
import type { Persistence } from "firebase/auth";
import { firebaseApp, firestoreDb } from "../services/firebase";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require("@firebase/auth") as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

function initStaffAuth() {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const staffAuth = initStaffAuth();
export const staffDb = firestoreDb;
export const staffFunctions = getFunctions(firebaseApp);
