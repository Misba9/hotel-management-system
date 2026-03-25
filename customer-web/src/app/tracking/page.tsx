"use client";

import { useState } from "react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { OrderTracker } from "@/components/tracking/order-tracker";
import { auth } from "@shared/firebase/client";
import { buildUserHeaders } from "@/lib/user-session";

const statuses = ["pending", "preparing", "ready", "out_for_delivery", "delivered"];
type TrackingUiState = "idle" | "loading" | "success" | "not_found" | "error";
type TrackingResponse = {
  orderId?: string;
  status?: string;
  updatedAt?: string;
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
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [riderName, setRiderName] = useState<string>("");
  const [riderPhone, setRiderPhone] = useState<string>("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const [cancelling, setCancelling] = useState(false);

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

  async function refreshTracking() {
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
      setEtaMinutes(typeof data.realtimeTracking?.etaMinutes === "number" ? data.realtimeTracking.etaMinutes : null);
      setRiderName(typeof data.delivery?.riderName === "string" ? data.delivery.riderName : "");
      setRiderPhone(typeof data.delivery?.riderPhone === "string" ? data.delivery.riderPhone : "");
      if (typeof data.realtimeTracking?.lat === "number" && typeof data.realtimeTracking?.lng === "number") {
        setCoordinates({ lat: data.realtimeTracking.lat, lng: data.realtimeTracking.lng });
      } else {
        setCoordinates(null);
      }
      setUiState("success");
    } catch {
      setUiState("error");
      setError("Network error while loading tracking status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!trackingId) return;
    void refreshTracking();
    const interval = window.setInterval(() => {
      void refreshTracking();
    }, 8000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingId, trackingToken]);

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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Order Tracking</h1>
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button onClick={refreshTracking} disabled={loading} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
            {loading ? "Loading..." : "Track"}
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Tracking ID: {trackingId || "N/A"}</p>
        {uiState === "loading" ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Loading tracking status...
          </div>
        ) : null}
        {uiState === "not_found" ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <p className="font-medium">Order not found</p>
            <button onClick={refreshTracking} className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-xs text-white">
              Retry
            </button>
          </div>
        ) : null}
        {uiState === "error" && error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            <p>{error}</p>
            <button onClick={refreshTracking} className="mt-2 rounded bg-red-600 px-3 py-1.5 text-xs text-white">
              Retry
            </button>
          </div>
        ) : null}
        <OrderTracker activeStep={Math.max(statuses.indexOf(status), 0)} />
        {uiState === "success" ? (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
            <p>
              ETA:{" "}
              <span className="font-medium">{typeof etaMinutes === "number" ? `${Math.max(etaMinutes, 1)} mins` : "Calculating..."}</span>
            </p>
            <p>
              Rider:{" "}
              <span className="font-medium">{riderName || "Will be assigned soon"}</span>
              {riderPhone ? ` (${riderPhone})` : ""}
            </p>
            <p>
              Last update:{" "}
              <span className="font-medium">{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "N/A"}</span>
            </p>
            {coordinates ? (
              <a
                href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded bg-slate-900 px-3 py-1.5 text-xs text-white"
              >
                Open Live Location
              </a>
            ) : null}
          </div>
        ) : null}
        <button onClick={refreshTracking} disabled={loading} className="mt-5 rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">
          Refresh Status
        </button>
        {orderId && ["pending", "confirmed", "preparing", "ready"].includes(status) ? (
          <button
            onClick={() => void cancelOrder()}
            disabled={cancelling}
            className="ml-2 mt-5 rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60"
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        ) : null}
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-500">Current: {status}</p>
      </motion.div>
    </section>
  );
}
