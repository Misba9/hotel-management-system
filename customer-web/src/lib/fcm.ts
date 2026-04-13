import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { db, getClientMessaging } from "@/lib/firebase";

let lastRegisteredToken: string | null = null;
let lastRegisteredUid: string | null = null;

function getVapidKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  return k || undefined;
}

export async function removeFcmTokenFromUser(uid: string): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) return;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const data = snap.data() as { fcmToken?: string } | undefined;
    const updates: Record<string, unknown> = {
      fcmTokens: arrayRemove(token)
    };
    if (data?.fcmToken === token) {
      updates.fcmToken = deleteField();
    }
    await updateDoc(ref, updates);
  } catch {
    /* doc may not exist */
  }
  lastRegisteredToken = null;
  lastRegisteredUid = null;
}

/**
 * Registers SW + saves token when Notification.permission === "granted".
 */
export async function registerPushTokenForUser(uid: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || Notification.permission !== "granted") return null;
  if (!(await isSupported())) return null;

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    return null;
  }

  const messaging = await getClientMessaging();
  if (!messaging) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });
    await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return null;

    await setDoc(
      doc(db, "users", uid),
      {
        id: uid,
        fcmToken: token,
        fcmTokens: arrayUnion(token)
      },
      { merge: true }
    );

    lastRegisteredToken = token;
    lastRegisteredUid = uid;
    return token;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[fcm] register failed", e);
    }
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function subscribeForegroundMessages(
  messaging: Messaging,
  onPayload: (title: string, body: string) => void
): () => void {
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Order update";
    const body = payload.notification?.body ?? "";
    onPayload(title, body);
  });
}

export function getLastFcmRegistration(): { uid: string | null; token: string | null } {
  return { uid: lastRegisteredUid, token: lastRegisteredToken };
}
