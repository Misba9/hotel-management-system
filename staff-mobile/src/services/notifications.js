/**
 * In-app order alerts: expo-av sound, haptics, optional OS badge (expo-notifications).
 * Firestore listeners pass `orders` arrays — hooks diff snapshots to detect new work.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Vibration } from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

let badgePermissionRequested = false;

async function ensureBadgePermission() {
  if (Platform.OS === "web") return;
  if (badgePermissionRequested) return;
  try {
    const Notifications = await import("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
    badgePermissionRequested = true;
  } catch {
    badgePermissionRequested = true;
  }
}

/**
 * Clears the app icon badge (call on sign-out).
 */
export async function clearStaffNotificationBadge() {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* noop */
  }
}

/**
 * Syncs home-screen badge to actionable count (kitchen queue or delivery stops).
 */
export function useSyncStaffAppBadge(count) {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let cancelled = false;
    void (async () => {
      await ensureBadgePermission();
      if (cancelled) return;
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.setBadgeCountAsync(Math.max(0, Math.min(999, Math.floor(Number(count) || 0))));
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [count]);
}

/**
 * Short tone — bundled `assets/sounds/notification.mp3`.
 */
export async function playNotificationSound() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/notification.mp3"),
      { shouldPlay: true, volume: 1 }
    );
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[playNotificationSound]", e);
    }
  }
}

/**
 * Sound + haptic (+ short vibration on Android) for staff attention events.
 * @param {'kitchen_new' | 'delivery_ready' | 'delivered'} kind
 */
/** Light confirmation for rider after marking delivered (no sound — avoids spam; customer push is separate). */
export async function staffDeliveredFeedback() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "android") {
      Vibration.vibrate(45);
    }
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[staffDeliveredFeedback]", e);
    }
  }
}

export async function staffPhysicalAlert(kind) {
  await playNotificationSound();
  if (Platform.OS === "web") return;
  try {
    if (kind === "kitchen_new") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (Platform.OS === "android") {
      Vibration.vibrate(90);
    }
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[staffPhysicalAlert]", e);
    }
  }
}

/**
 * Placeholder for customer push when an order is marked delivered (FCM / callable TBD).
 * @param {string} _orderId
 */
export function notifyCustomerDeliveredStub(_orderId) {
  /* Future: HTTPS callable → customer FCM / in-app notification */
}

/**
 * Kitchen: any new order id entering the realtime kitchen queue (same filter as subscribeKitchenOrders).
 * @param {import('./orders.js').StaffOrder[]} orders
 */
export function useKitchenOrderAlerts(orders) {
  const [banner, setBanner] = useState(null);
  const initial = useRef(true);
  const prevIdsRef = useRef(new Set());

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (initial.current) {
      initial.current = false;
      prevIdsRef.current = ids;
      return;
    }
    const newIds = [...ids].filter((id) => !prevIdsRef.current.has(id));
    prevIdsRef.current = ids;
    if (newIds.length > 0) {
      void staffPhysicalAlert("kitchen_new");
      setBanner({
        message:
          newIds.length === 1
            ? "New order — check the queue."
            : `${newIds.length} new orders — check the queue.`,
        tone: "info"
      });
    }
  }, [orders]);

  const dismissBanner = useCallback(() => setBanner(null), []);
  return { banner, dismissBanner };
}

/**
 * Delivery: order just became `ready` (new id in pool or first time we see it as ready).
 * @param {import('./orders.js').StaffOrder[]} orders
 */
export function useDeliveryReadyAlerts(orders) {
  const [banner, setBanner] = useState(null);
  const initial = useRef(true);
  const seenReady = useRef(new Set());

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      orders.filter((o) => String(o.status ?? "").toLowerCase() === "ready").forEach((o) => seenReady.current.add(o.id));
      return;
    }
    for (const o of orders) {
      if (String(o.status ?? "").toLowerCase() !== "ready") continue;
      if (seenReady.current.has(o.id)) continue;
      seenReady.current.add(o.id);
      void staffPhysicalAlert("delivery_ready");
      setBanner({ message: "Order ready for pickup / delivery.", tone: "success" });
      break;
    }
  }, [orders]);

  const dismissBanner = useCallback(() => setBanner(null), []);
  return { banner, dismissBanner };
}

const EMPTY_ORDERS = [];

/**
 * @param {'kitchen' | 'delivery'} role
 * @param {import('./orders.js').StaffOrder[]} orders — same realtime list as your screen
 */
export function useOrderNotifications(role, orders) {
  const kitchen = useKitchenOrderAlerts(role === "kitchen" ? orders : EMPTY_ORDERS);
  const delivery = useDeliveryReadyAlerts(role === "delivery" ? orders : EMPTY_ORDERS);
  const out = role === "kitchen" ? kitchen : delivery;

  const badgeCount =
    role === "kitchen"
      ? orders.length
      : role === "delivery"
        ? orders.length
        : 0;

  useSyncStaffAppBadge(role === "kitchen" || role === "delivery" ? badgeCount : 0);

  return { ...out, badgeCount };
}
