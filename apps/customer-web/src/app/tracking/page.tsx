"use client";

import { useState } from "react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { OrderTracker } from "@/components/tracking/order-tracker";
import { auth } from "@shared/firebase/client";

const statuses = ["pending", "preparing", "ready", "out_for_delivery", "delivered"];
type TrackingUiState = "idle" | "loading" | "success" | "not_found" | "error";

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

      const data = (await res.json()) as { status?: string } | null;
      if (!data?.status) {
        setUiState("error");
        setError("Invalid tracking response.");
        return;
      }
      setStatus(data.status);
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
        <button onClick={refreshTracking} disabled={loading} className="mt-5 rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">
          Refresh Status
        </button>
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-500">Current: {status}</p>
      </motion.div>
    </section>
  );
}
