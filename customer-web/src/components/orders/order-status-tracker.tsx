"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  CUSTOMER_PIPELINE_STEPS,
  customerOrderPipelineStepIndex,
  formatCustomerStatusLine,
  isCancelledOrderStatus
} from "@/lib/customer-order-progress";
import { Activity, Loader2 } from "lucide-react";

export { customerOrderPipelineStepIndex as orderStatusStepIndex } from "@/lib/customer-order-progress";

export function OrderStatusTracker({
  orderId,
  trackingToken,
  initialStatus = "pending"
}: {
  orderId: string;
  trackingToken?: string;
  initialStatus?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [mode, setMode] = useState<"firestore" | "poll" | "static">("static");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let unsubSnap: (() => void) | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const clearPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    async function pollOnce() {
      if (!trackingToken || cancelled) return;
      try {
        const res = await fetch(
          `/api/tracking/${encodeURIComponent(orderId)}?t=${encodeURIComponent(trackingToken)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (typeof data.status === "string" && !cancelled) {
          setStatus(data.status);
          setHint(null);
        }
      } catch {
        /* ignore */
      }
    }

    function startPolling() {
      clearPoll();
      if (!trackingToken || cancelled) return;
      setMode("poll");
      setHint("Live updates every few seconds.");
      void pollOnce();
      pollTimer = setInterval(() => void pollOnce(), 4000);
    }

    const authUnsub = onAuthStateChanged(auth, (user) => {
      unsubSnap?.();
      unsubSnap = undefined;
      clearPoll();
      if (cancelled) return;

      if (user) {
        setMode("firestore");
        setHint("Live updates from Firestore.");
        const ref = doc(db, "orders", orderId);
        unsubSnap = onSnapshot(
          ref,
          (snap) => {
            if (!snap.exists()) {
              setHint("Order document not found.");
              return;
            }
            const s = snap.data()?.status;
            setStatus(typeof s === "string" ? s : "pending");
            setHint("Live updates from Firestore.");
          },
          () => {
            unsubSnap?.();
            unsubSnap = undefined;
            if (trackingToken) {
              startPolling();
            } else {
              setMode("static");
              setHint(
                "Sign in with the same account you used to place the order, or open the tracking link from your confirmation."
              );
            }
          }
        );
      } else if (trackingToken) {
        startPolling();
      } else {
        setMode("static");
        setHint(
          "Sign in with the same account you used to place the order, or use the tracking link from checkout for live updates."
        );
      }
    });

    return () => {
      cancelled = true;
      unsubSnap?.();
      clearPoll();
      authUnsub();
    };
  }, [orderId, trackingToken]);

  const cancelled = isCancelledOrderStatus(status);
  const activeIndex = cancelled ? -1 : customerOrderPipelineStepIndex(status);

  return (
    <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-b from-orange-50/90 to-white p-5 dark:border-orange-900/40 dark:from-orange-950/30 dark:to-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" aria-hidden />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Order progress</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          {mode === "firestore" || mode === "poll" ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Snapshot
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-sm font-medium text-orange-800 dark:text-orange-200">
        Current: <span className="tabular-nums">{formatCustomerStatusLine(status)}</span>
      </p>

      {hint && mode === "static" ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{hint}</p> : null}
      {hint && mode !== "static" ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p> : null}

      {cancelled ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          This order was cancelled.
        </p>
      ) : (
        <ol className="mt-5 space-y-0">
          {CUSTOMER_PIPELINE_STEPS.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            const pending = i > activeIndex;
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-500 text-white"
                        : current
                          ? "bg-orange-500 text-white ring-4 ring-orange-200 dark:ring-orange-900/50"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    }`}
                    aria-current={current ? "step" : undefined}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {i < CUSTOMER_PIPELINE_STEPS.length - 1 ? (
                    <span
                      className={`my-1 h-8 w-0.5 shrink-0 ${done ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className={`pb-6 pt-1 ${pending ? "opacity-70" : ""}`}>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{step.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {mode === "poll" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Syncing status…
        </p>
      ) : null}
    </div>
  );
}
