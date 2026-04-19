"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { firestoreTimeToIso } from "@/lib/order-tracking";

export type LiveOrderState = {
  status: string;
  updatedAtIso: string;
  estimatedDeliveryAtIso?: string;
  /** From `orders.riderLocation` — live GPS from delivery app. */
  riderLocation: { lat: number; lng: number } | null;
  /** From `orders.deliveryAddress.lat` / `lng` when geocoded at checkout. */
  deliveryCoords: { lat: number; lng: number } | null;
  etaMinutes: number | null;
};

export type LiveDeliveryPatch = {
  etaMinutes?: number;
  lat?: number;
  lng?: number;
};

function mapListenerError(err: unknown): string | null {
  const code =
    typeof err === "object" && err !== null && "code" in err ? String((err as { code: string }).code) : "";
  if (code === "permission-denied") {
    return "You don't have permission to view live tracking for this order.";
  }
  if (code === "unavailable") {
    return "Live tracking is temporarily unavailable. Please try again.";
  }
  return null;
}

function parseLatLngPair(obj: unknown): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

/**
 * Subscribes to `orders/{orderDocId}` only: status, ETA fields, `riderLocation`, and delivery geocode.
 * Staff apps write rider GPS to `orders.riderLocation` (and may mirror `deliveryLocations` for legacy).
 */
export function useOrderRealtime(orderDocId: string | null) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [orderLive, setOrderLive] = useState<LiveOrderState | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const deliveryPatch = useMemo((): LiveDeliveryPatch => {
    const rl = orderLive?.riderLocation;
    const eta = orderLive?.etaMinutes;
    const out: LiveDeliveryPatch = {};
    if (rl) {
      out.lat = rl.lat;
      out.lng = rl.lng;
    }
    if (typeof eta === "number" && Number.isFinite(eta)) out.etaMinutes = eta;
    return out;
  }, [orderLive]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!orderDocId || !user) {
      setOrderLive(null);
      setRealtimeError(null);
      return;
    }

    setRealtimeError(null);
    const orderRef = doc(db, "orders", orderDocId);

    const offOrder = onSnapshot(
      orderRef,
      (snap) => {
        if (!snap.exists()) {
          setOrderLive(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const status = String(d.status ?? "pending");
        const riderLocation = parseLatLngPair(d.riderLocation);
        const deliveryCoords = parseLatLngPair(d.deliveryAddress);
        const etaRaw = d.etaMinutes;
        const etaMinutes =
          typeof etaRaw === "number" && Number.isFinite(etaRaw) ? etaRaw : null;

        setOrderLive({
          status,
          updatedAtIso: firestoreTimeToIso(d.updatedAt ?? d.createdAt),
          estimatedDeliveryAtIso:
            typeof d.estimatedDeliveryAt === "string"
              ? d.estimatedDeliveryAt
              : typeof d.estimatedDeliveryBy === "string"
                ? d.estimatedDeliveryBy
                : undefined,
          riderLocation,
          deliveryCoords,
          etaMinutes
        });
      },
      (err) => {
        setOrderLive(null);
        const msg = mapListenerError(err);
        if (msg) setRealtimeError(msg);
      }
    );

    return () => {
      offOrder();
    };
  }, [orderDocId, user]);

  return {
    firebaseUser: user,
    isLiveEnabled: Boolean(user && orderDocId),
    orderLive,
    deliveryPatch,
    realtimeError
  };
}
