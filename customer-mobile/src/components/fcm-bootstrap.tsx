import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/src/context/auth-context";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/services/firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function FcmBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    void (async () => {
      try {
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
        /* FCM optional — Expo push token may require project config */
      }
    })();
  }, [user?.uid]);

  return null;
}
