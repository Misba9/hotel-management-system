"use client";

import { useEffect, useState, type ComponentType } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AlertCircle, IndianRupee, Package, RefreshCw, TrendingUp, Users } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { adminApiFetch } from "@/shared/lib/admin-api";

type SummaryMetrics = {
  ordersToday: number;
  pendingOrders: number;
  revenueToday: number;
  activeOrders: number;
  customers: number;
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent
}: {
  title: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent: "slate" | "amber" | "emerald" | "violet" | "sky";
}) {
  const styles: Record<typeof accent, { ring: string; icon: string }> = {
    slate: {
      ring: "ring-slate-200/90 bg-white hover:shadow-lg dark:bg-slate-900 dark:ring-slate-700",
      icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    },
    amber: {
      ring: "ring-amber-200/80 bg-white hover:shadow-lg dark:bg-slate-900 dark:ring-amber-900/40",
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
    },
    emerald: {
      ring: "ring-emerald-200/80 bg-white hover:shadow-lg dark:bg-slate-900 dark:ring-emerald-900/40",
      icon: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
    },
    violet: {
      ring: "ring-violet-200/80 bg-white hover:shadow-lg dark:bg-slate-900 dark:ring-violet-900/40",
      icon: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
    },
    sky: {
      ring: "ring-sky-200/80 bg-white hover:shadow-lg dark:bg-slate-900 dark:ring-sky-900/40",
      icon: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
    }
  };
  const s = styles[accent];

  return (
    <div
      className={`group rounded-xl p-5 shadow-md ring-1 transition-all duration-200 hover:-translate-y-0.5 ${s.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            {value}
          </p>
          {hint ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition group-hover:scale-105 ${s.icon}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function SummarySkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true" aria-label="Loading summary">
      {["a", "b", "c", "d"].map((key) => (
        <div key={key} className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-2 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPageFeature() {
  const { user, authClaimsResolved } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [highVolumeAlert, setHighVolumeAlert] = useState<{
    active: boolean;
    message: string;
    count: number;
    threshold: number;
  } | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setLoading(false);
      setError("Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_PROJECT_ID).");
      return;
    }

    if (!user) {
      setSummary(null);
      setLoading(false);
      setError("Sign in to load live order stats.");
      return;
    }

    if (!authClaimsResolved) {
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApiFetch("/api/dashboard/summary");
        const data = (await res.json()) as SummaryMetrics;
        if (cancelled) return;
        if (
          typeof data.ordersToday === "number" &&
          typeof data.pendingOrders === "number" &&
          typeof data.revenueToday === "number" &&
          typeof data.activeOrders === "number" &&
          typeof data.customers === "number"
        ) {
          setSummary(data);
          setError(null);
        } else {
          setSummary(null);
          setError("Unexpected summary response.");
        }
      } catch (e) {
        if (cancelled) return;
        setSummary(null);
        setError(e instanceof Error ? e.message : "Could not load dashboard summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, authClaimsResolved, refreshKey]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    let unsubscribe: (() => void) | undefined;
    try {
      const db = getFirebaseDb();
      unsubscribe = onSnapshot(doc(db, "adminAlerts", "highOrderVolume"), (snapshot) => {
        const payload = snapshot.data() as
          | {
              active?: boolean;
              message?: string;
              count?: number;
              threshold?: number;
            }
          | undefined;
        if (!payload) return;
        setHighVolumeAlert({
          active: Boolean(payload.active),
          message: String(payload.message ?? ""),
          count: Number(payload.count ?? 0),
          threshold: Number(payload.threshold ?? 0)
        });
      });
    } catch {
      /* optional */
    }
    return () => unsubscribe?.();
  }, []);

  const showCards = !loading && !error && summary;

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Live metrics from your store — refreshes about every 45s while this tab is open.
        </p>
      </div>

      {error ? (
        <div
          className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50 dark:bg-red-950/30"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <p className="text-sm font-medium text-red-900 dark:text-red-100">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setRefreshKey((k) => k + 1);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-red-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <SummarySkeletonGrid /> : null}

      {highVolumeAlert?.active ? (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200">High order volume</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {highVolumeAlert.message} (threshold: {highVolumeAlert.threshold})
            </p>
          </div>
        </div>
      ) : null}

      {showCards && summary ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Total orders"
            value={String(summary.ordersToday)}
            hint="Placed today (server local day)"
            icon={Package}
            accent="amber"
          />
          <StatCard
            title="Revenue"
            value={`Rs. ${summary.revenueToday.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            hint="Gross total for today"
            icon={IndianRupee}
            accent="emerald"
          />
          <StatCard
            title="Active orders"
            value={String(summary.activeOrders)}
            hint="In pipeline (pending → out for delivery)"
            icon={TrendingUp}
            accent="violet"
          />
          <StatCard
            title="Customers"
            value={String(summary.customers)}
            hint="Profiles in users collection"
            icon={Users}
            accent="sky"
          />
        </div>
      ) : null}
    </section>
  );
}
