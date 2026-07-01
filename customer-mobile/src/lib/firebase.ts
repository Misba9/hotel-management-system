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
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = initCustomerAuth();
export { firestoreDb as db };
