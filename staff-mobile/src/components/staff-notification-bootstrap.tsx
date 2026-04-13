import { useEffect } from "react";
import { Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { logError } from "../lib/error-logging";
import { staffAuth } from "../lib/firebase";
import { registerStaffPushToken } from "../lib/register-staff-push-token";

/**
 * Foreground FCM/device token registration + notification handler (badge + alerts).
 * Tokens live on `users/{uid}` for Cloud Functions (`sendEachForMulticast`).
 */
export function StaffNotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let cancelled = false;
    void import("expo-notifications")
      .then((Notifications) => {
        if (cancelled) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true
          })
        });
      })
      .catch((e) => {
        logError("StaffNotificationBootstrap.expo-notifications", e);
      });
    return () => {
      cancelled = true;
    };
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
