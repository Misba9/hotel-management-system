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

/**
 * Subscribes to `orders/{orderDocId}` and `deliveryLocations/{orderDocId}`.
 * Map position + ETA come from `deliveryLocations` (updated by staff/API or Cloud Functions).
 */
export function useOrderRealtime(orderDocId: string | null) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [orderLive, setOrderLive] = useState<LiveOrderState | null>(null);
  const [locMirror, setLocMirror] = useState<LiveDeliveryPatch | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const deliveryPatch = useMemo((): LiveDeliveryPatch => {
    const lat = locMirror?.lat;
    const lng = locMirror?.lng;
    const eta = locMirror?.etaMinutes;
    const out: LiveDeliveryPatch = {};
    if (typeof lat === "number" && Number.isFinite(lat)) out.lat = lat;
    if (typeof lng === "number" && Number.isFinite(lng)) out.lng = lng;
    if (typeof eta === "number" && Number.isFinite(eta)) out.etaMinutes = eta;
    return out;
  }, [locMirror]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!orderDocId || !user) {
      setOrderLive(null);
      setLocMirror(null);
      setRealtimeError(null);
      return;
    }

    setRealtimeError(null);
    const orderRef = doc(db, "orders", orderDocId);
    const locationRef = doc(db, "deliveryLocations", orderDocId);

    const offOrder = onSnapshot(
      orderRef,
      (snap) => {
        if (!snap.exists()) {
          setOrderLive(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const status = String(d.status ?? "pending");
        setOrderLive({
          status,
          updatedAtIso: firestoreTimeToIso(d.updatedAt ?? d.createdAt),
          estimatedDeliveryAtIso:
            typeof d.estimatedDeliveryAt === "string"
              ? d.estimatedDeliveryAt
              : typeof d.estimatedDeliveryBy === "string"
                ? d.estimatedDeliveryBy
                : undefined
        });
      },
      (err) => {
        setOrderLive(null);
        const msg = mapListenerError(err);
        if (msg) setRealtimeError(msg);
      }
    );

    const offLoc = onSnapshot(
      locationRef,
      (snap) => {
        if (!snap.exists()) {
          setLocMirror(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const patch: LiveDeliveryPatch = {};
        const eta = d.etaMinutes;
        const lat = d.lat;
        const lng = d.lng;
        if (typeof eta === "number" && Number.isFinite(eta)) patch.etaMinutes = eta;
        if (typeof lat === "number" && Number.isFinite(lat)) patch.lat = lat;
        if (typeof lng === "number" && Number.isFinite(lng)) patch.lng = lng;
        setLocMirror(patch);
      },
      (err) => {
        setLocMirror(null);
        const msg = mapListenerError(err);
        if (msg) setRealtimeError(msg);
      }
    );

    return () => {
      offOrder();
      offLoc();
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
