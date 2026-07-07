import { getAuth, initializeAuth } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Persistence } from "firebase/auth";
import { firebaseApp, firestoreDb } from "../services/firebase";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require("@firebase/auth") as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

function initCustomerAuth() {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }
  try {
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
