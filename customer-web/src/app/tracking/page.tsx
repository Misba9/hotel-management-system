"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { OrderStatusStepperHorizontal } from "@/components/tracking/order-status-stepper-horizontal";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { formatEstimatedDelivery } from "@/lib/order-tracking";
import { auth } from "@/lib/firebase";
import { buildUserHeaders } from "@/lib/user-session";

const DeliveryMap = dynamic(
  () => import("@/components/tracking/delivery-map").then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(42vh,320px)] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" aria-hidden />
    )
  }
);

type TrackingUiState = "idle" | "loading" | "success" | "not_found" | "error";
type TrackingResponse = {
  orderId?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
  estimatedDeliveryAt?: string;
  realtimeTracking?: {
    etaMinutes?: number;
    lat?: number;
    lng?: number;
    speedKmph?: number;
  } | null;
  delivery?: {
    riderName?: string;
    riderPhone?: string;
  } | null;
};

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("trackingId");
  const tokenFromUrl = searchParams.get("t") ?? "";
  const [trackingId, setTrackingId] = useState(fromUrl ?? "");
  const [trackingToken, setTrackingToken] = useState(tokenFromUrl);
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(false);
  const [uiState, setUiState] = useState<TrackingUiState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [createdAtIso, setCreatedAtIso] = useState<string>("");
  const [estimatedDeliveryAtRest, setEstimatedDeliveryAtRest] = useState<string | null>(null);
  const [etaMinutesRest, setEtaMinutesRest] = useState<number | null>(null);
  const [riderName, setRiderName] = useState<string>("");
  const [riderPhone, setRiderPhone] = useState<string>("");
  const [coordinatesRest, setCoordinatesRest] = useState<{ lat: number; lng: number } | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const [cancelling, setCancelling] = useState(false);

  const { isLiveEnabled, orderLive, deliveryPatch, realtimeError } = useOrderRealtime(orderId || null);

  useEffect(() => {
    if (orderLive) {
      setStatus(orderLive.status);
      setUpdatedAt(orderLive.updatedAtIso);
    }
  }, [orderLive]);

  useEffect(() => {
    if (!fromUrl) {
      const raw = window.localStorage.getItem("nausheen_last_tracking");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { trackingId?: string; trackingToken?: string };
          if (parsed.trackingId) setTrackingId(parsed.trackingId);
          if (parsed.trackingToken) setTrackingToken(parsed.trackingToken);
        } catch {
          window.localStorage.removeItem("nausheen_last_tracking");
        }
      }
    }
  }, [fromUrl]);

  const refreshTracking = useCallback(async () => {
    if (!trackingId.trim()) return;
    setError(null);
    setLoading(true);
    setUiState("loading");
    try {
      const token = trackingToken.trim();
      const query = token ? `?t=${encodeURIComponent(token)}` : "";
      const headers: HeadersInit = {};
      const currentUser = auth.currentUser;
      if (currentUser) {
        headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
      }
      const res = await fetch(`/api/tracking/${encodeURIComponent(trackingId)}${query}`, { headers });

      if (res.status === 404) {
        setUiState("not_found");
        setError("Order not found");
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setUiState("error");
        setError("You are not allowed to view this order.");
        return;
      }
      if (!res.ok) {
        setUiState("error");
        setError("Unable to load tracking status right now.");
        return;
      }

      const data = (await res.json()) as TrackingResponse | null;
      if (!data?.status) {
        setUiState("error");
        setError("Invalid tracking response.");
        return;
      }
      setStatus(data.status);
      setOrderId(typeof data.orderId === "string" ? data.orderId : "");
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : "");
      setCreatedAtIso(typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString());
      setEstimatedDeliveryAtRest(typeof data.estimatedDeliveryAt === "string" ? data.estimatedDeliveryAt : null);
      setEtaMinutesRest(
        typeof data.realtimeTracking?.etaMinutes === "number" ? data.realtimeTracking.etaMinutes : null
      );
      setRiderName(typeof data.delivery?.riderName === "string" ? data.delivery.riderName : "");
      setRiderPhone(typeof data.delivery?.riderPhone === "string" ? data.delivery.riderPhone : "");
      if (typeof data.realtimeTracking?.lat === "number" && typeof data.realtimeTracking?.lng === "number") {
        setCoordinatesRest({ lat: data.realtimeTracking.lat, lng: data.realtimeTracking.lng });
      } else {
        setCoordinatesRest(null);
      }
      setUiState("success");
      window.localStorage.setItem(
        "nausheen_last_tracking",
        JSON.stringify({ trackingId, trackingToken: token || undefined })
      );
    } catch {
      setUiState("error");
      setError("Network error while loading tracking status.");
    } finally {
      setLoading(false);
    }
  }, [trackingId, trackingToken]);

  useEffect(() => {
    if (!trackingId) return;
    void refreshTracking();
  }, [trackingId, trackingToken, refreshTracking]);

  useEffect(() => {
    if (!trackingId || isLiveEnabled) return;
    const interval = window.setInterval(() => {
      void refreshTracking();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [trackingId, isLiveEnabled, refreshTracking]);

  const effectiveEtaMinutes = deliveryPatch.etaMinutes ?? etaMinutesRest;
  const coordinates =
    deliveryPatch.lat !== undefined && deliveryPatch.lng !== undefined
      ? { lat: deliveryPatch.lat, lng: deliveryPatch.lng }
      : coordinatesRest;

  const etaSummary = useMemo(
    () =>
      formatEstimatedDelivery({
        status,
        createdAtIso: createdAtIso || updatedAt || new Date().toISOString(),
        etaMinutesFromRider: effectiveEtaMinutes,
        estimatedDeliveryAtIso: orderLive?.estimatedDeliveryAtIso ?? estimatedDeliveryAtRest
      }),
    [status, createdAtIso, updatedAt, effectiveEtaMinutes, orderLive?.estimatedDeliveryAtIso, estimatedDeliveryAtRest]
  );

  async function cancelOrder() {
    if (!orderId) return;
    setCancelling(true);
    setError(null);
    try {
      const headers = await buildUserHeaders();
      const response = await fetch(`/api/user/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to cancel order.");
      }
      setStatus("cancelled");
      setUiState("success");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel order.");
      setUiState("error");
    } finally {
      setCancelling(false);
    }
  }

  const cancellableStatuses = ["pending", "accepted", "confirmed", "preparing", "ready"];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Order tracking</h1>
        {isLiveEnabled && uiState === "success" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live updates
          </span>
        ) : null}
        {!isLiveEnabled && uiState === "success" ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">Updates every ~12s · sign in for live sync</span>
        ) : null}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="Enter tracking ID"
            disabled={loading}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={() => void refreshTracking()}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {loading ? "Loading…" : "Track"}
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Tracking ID: {trackingId || "N/A"}</p>
        {uiState === "loading" ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50">
            Loading tracking status…
          </div>
        ) : null}
        {uiState === "not_found" ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Order not found</p>
            <button
              type="button"
              onClick={() => void refreshTracking()}
              className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-xs text-white"
            >
              Retry
            </button>
          </div>
        ) : null}
        {realtimeError ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p>{realtimeError}</p>
          </div>
        ) : null}

        {uiState === "error" && error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void refreshTracking()}
              className="mt-2 rounded bg-red-600 px-3 py-1.5 text-xs text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {uiState === "success" ? (
          <OrderStatusStepperHorizontal status={status} className="mt-2 border-b border-slate-100 pb-6 dark:border-slate-800" />
        ) : null}

        {uiState === "success" && coordinates ? (
          <div className="mt-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Live map
            </h2>
            <DeliveryMap
              lat={coordinates.lat}
              lng={coordinates.lng}
              etaMinutes={effectiveEtaMinutes}
              agentMarkerTitle="Delivery partner"
            />
          </div>
        ) : null}

        {uiState === "success" && !coordinates && (status === "out_for_delivery" || status === "ready") ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            Live map will appear when your delivery partner shares their location. You can still track status above.
          </div>
        ) : null}

        {uiState === "success" ? (
          <div className="mt-6 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
            <p>
              Estimated delivery: <span className="font-semibold text-slate-900 dark:text-slate-50">{etaSummary}</span>
            </p>
            <p>
              Rider:{" "}
              <span className="font-medium">{riderName || "Will be assigned soon"}</span>
              {riderPhone ? ` (${riderPhone})` : ""}
            </p>
            <p>
              Last update:{" "}
              <span className="font-medium">
                {updatedAt ? new Date(updatedAt).toLocaleString() : "N/A"}
              </span>
            </p>
            {coordinates ? (
              <a
                href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Open live location
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshTracking()}
            disabled={loading}
            className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Refresh status
          </button>
          {orderId && cancellableStatuses.includes(status) ? (
            <button
              type="button"
              onClick={() => void cancelOrder()}
              disabled={cancelling}
              className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          ) : null}
        </div>
        {uiState === "success" ? (
          <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Status: <span className="ml-1 font-medium capitalize">{status.replace(/_/g, " ")}</span>
          </p>
        ) : null}
      </motion.div>
    </section>
  );
}
