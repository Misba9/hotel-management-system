import { isRunningInExpoGo } from "expo";
import { useEffect } from "react";
import { Platform } from "react-native";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/src/context/auth-context";
import { db } from "@/src/services/firebase";

/**
 * Registers an Expo push token on `users/{uid}` for Cloud Functions.
 * Skipped in Expo Go (SDK 53+ removed Android remote push from Expo Go —
 * use a development build for push).
 */
export function FcmBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid || Platform.OS === "web" || isRunningInExpoGo()) return;

    void (async () => {
      try {
        const Notifications = await import("expo-notifications");

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true
          })
        });

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        if (!token) return;

        await setDoc(
          doc(db, "users", user.uid),
          {
            fcmTokens: { [token]: { platform: Platform.OS, updatedAt: serverTimestamp() } }
          },
          { merge: true }
        );
      } catch {
        /* Push is optional — Expo Go / missing project config should not crash the app */
      }
    })();
  }, [user?.uid]);

  return null;
}
