import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Foreground notification handler (badge + optional alerts). In-app order sounds use expo-av separately.
 */
export function StaffNotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let cancelled = false;
    void import("expo-notifications").then((Notifications) => {
      if (cancelled) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: true
        })
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
