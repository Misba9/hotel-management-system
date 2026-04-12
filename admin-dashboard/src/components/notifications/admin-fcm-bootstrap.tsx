"use client";

import { useEffect } from "react";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import { getToken, isSupported, onMessage } from "firebase/messaging";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase";

function getVapidKey(): string | undefined {
  const v = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  return v || undefined;
}

/**
 * Registers admin FCM token in `users/{uid}` and shows foreground notifications.
 */
export function AdminFcmBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    let unsubMsg: (() => void) | undefined;
    void (async () => {
      if (!user) return;
      if (!(await isSupported())) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") return;
      const vapidKey = getVapidKey();
      if (!vapidKey) return;

      const { getMessaging } = await import("firebase/messaging");
      const messaging = getMessaging(getFirebaseApp());
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!token) return;

      await setDoc(
        doc(getFirebaseDb(), "users", user.uid),
        {
          uid: user.uid,
          fcmToken: token,
          fcmTokens: arrayUnion(token)
        },
        { merge: true }
      );

      unsubMsg = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "Admin update";
        const body = payload.notification?.body ?? "";
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body });
          } catch {
            /* ignore */
          }
        }
      });
    })();

    return () => {
      unsubMsg?.();
    };
  }, [user]);

  return null;
}
