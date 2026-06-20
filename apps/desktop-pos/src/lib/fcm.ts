/**
 * FCM scaffolding for desktop POS — forwards platform-order pushes to the main process.
 * Token registration is optional; Firestore posInbox listener is the offline-safe fallback.
 */
import { getPosFirebaseApp } from "./firebase";

export async function bootstrapPosFcm(): Promise<void> {
  if (!window.posApi?.registerFcmToken) return;

  const app = getPosFirebaseApp();
  if (!app || typeof Notification === "undefined") return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const { getMessaging, getToken, isSupported, onMessage } = await import("firebase/messaging");
    if (!(await isSupported())) return;

    const messaging = getMessaging(app);
    const vapidKey =
      import.meta.env.VITE_FIREBASE_VAPID_KEY ??
      import.meta.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.warn("[fcm] VAPID key missing — POS push registration skipped");
      return;
    }

    const token = await getToken(messaging, { vapidKey: String(vapidKey) });
    if (token) {
      await window.posApi.registerFcmToken(token, "Desktop POS Cashier");
    }

    onMessage(messaging, (payload) => {
      const data = payload.data ?? {};
      if (data.type === "platform_order") {
        window.posApi.notifyPlatformOrder(data as Record<string, string>);
      }
    });
  } catch (error) {
    console.warn("[fcm] POS messaging bootstrap skipped:", error);
  }
}
