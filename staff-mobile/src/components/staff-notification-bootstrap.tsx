import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { logError } from "../lib/error-logging";
import { staffAuth } from "../lib/firebase";
import { registerStaffPushToken } from "../lib/register-staff-push-token";

/**
 * Foreground FCM/device token registration + notification handler (badge + alerts).
 * Tokens live on `users/{uid}` for Cloud Functions (`sendEachForMulticast`).
 *
 * Uses a static `expo-notifications` import so Metro does not emit a lazy split bundle
 * that resolves to missing `staff-mobile/node_modules/...` when the package is hoisted.
 */
export function StaffNotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true
        })
      });
    } catch (e) {
      logError("StaffNotificationBootstrap.expo-notifications", e);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const unsub = onAuthStateChanged(staffAuth, (user) => {
      if (user?.uid) {
        void registerStaffPushToken(user.uid);
      }
    });
    return () => unsub();
  }, []);

  return null;
}
