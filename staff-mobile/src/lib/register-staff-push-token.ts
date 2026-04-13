import { Platform } from "react-native";
import { arrayUnion, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { staffDb } from "./firebase";
import { logError, logWarn } from "./error-logging";

/**
 * Registers the native device push token (FCM on Android) under `users/{uid}` so Cloud Functions can target staff.
 * Same shape as web FCM bootstrap (`fcmToken`, `fcmTokens`).
 */
export async function registerStaffPushToken(uid: string | undefined): Promise<void> {
  if (Platform.OS === "web" || !uid?.trim()) return;

  try {
    const Notifications = await import("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== "granted") {
      logWarn("registerStaffPushToken", "Notification permission not granted");
      return;
    }

    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device.data === "string" ? device.data : "";
    if (!token) {
      logWarn("registerStaffPushToken", "No device push token (use a physical device with FCM configured).");
      return;
    }

    await setDoc(
      doc(staffDb, "users", uid),
      {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        fcmTokenUpdatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    logError("registerStaffPushToken", e);
  }
}
