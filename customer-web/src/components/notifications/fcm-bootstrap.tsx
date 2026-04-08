"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getClientMessaging } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import {
  registerPushTokenForUser,
  removeFcmTokenFromUser,
  requestNotificationPermission,
  subscribeForegroundMessages
} from "@/lib/fcm";

/**
 * Registers FCM when the user is signed in and notifications are allowed;
 * removes token from Firestore on sign-out; shows foreground pushes as toasts.
 */
export function FcmBootstrap() {
  const { showToast } = useToast();
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubMsg: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const previousUid = uidRef.current;
      uidRef.current = user?.uid ?? null;

      unsubMsg?.();
      unsubMsg = undefined;

      if (!user) {
        if (previousUid) await removeFcmTokenFromUser(previousUid);
        return;
      }

      if (previousUid && previousUid !== user.uid) {
        await removeFcmTokenFromUser(previousUid);
      }

      await requestNotificationPermission();
      await registerPushTokenForUser(user.uid);

      const messaging = await getClientMessaging();
      if (messaging) {
        unsubMsg = subscribeForegroundMessages(messaging, (title, body) => {
          showToast({ title, description: body });
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            typeof document !== "undefined" &&
            document.visibilityState !== "visible"
          ) {
            try {
              new Notification(title, { body });
            } catch {
              /* ignore */
            }
          }
        });
      }
    });

    return () => {
      unsubAuth();
      unsubMsg?.();
    };
  }, [showToast]);

  return null;
}
