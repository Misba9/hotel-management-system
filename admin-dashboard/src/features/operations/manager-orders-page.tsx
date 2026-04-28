"use client";

/**
 * Firestore (client, admin rules):
 *
 * 1) Realtime first page — bounded window, newest first:
 *    query(
 *      collection(db, "orders"),
 *      orderBy("createdAt", "desc"),
 *      limit(40)
 *    )
 *    → onSnapshot(...)
 *
 * 2) Older pages — same query + startAfter(lastDoc):
 *    query(..., orderBy("createdAt", "desc"), startAfter(cursor), limit(40))
 *    → getDocs(...)
 *
 * Tab filters (PLACED / PREPARING / READY / COMPLETED) are applied in memory via
 * {@link managerOrderMatchesTab} from `@shared/utils/manager-order-operations`
 * so we avoid composite indexes on (status, createdAt).
 *
 * Writes: PATCH /api/orders/{id} with JSON { overrideStatus } or legacy { status }
 * (Admin Bearer token). Override skips strict lifecycle validation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Timestamp,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { AlertTriangle, Clock, Loader2, Package, UtensilsCrossed } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { playNewOrderChime } from "@/lib/new-order-chime";
import { useAuth } from "@/context/AuthContext";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { withRetry } from "@shared/utils/retry";
import {
  type ManagerDelaySeverity,
  type ManagerOrdersTab,
  getManagerOrderVisualBucket,
  managerOrderDelaySeverity,
  managerOrderMatchesTab,
  orderAgeMinutesFromIso
} from "@shared/utils/manager-order-operations";
import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";

type OrderItem = {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  qty?: number;
};

export type ManagerOrder = {
  id: string;
  customerName?: string;
  phone?: string;
  email?: string;
  items?: unknown[];
  totalAmount?: number;
  total?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  address?: string;
  createdAt?: string | null;
  orderType?: string;
  tableNumber?: number;
  tableId?: string;
  /** Waiter POS dine-in ticket */
  tokenNumber?: number;
  tableName?: string;
};

const TAB_FILTERS: ManagerOrdersTab[] = ["all", "placed", "preparing", "ready", "completed"];

const TAB_LABEL: Record<ManagerOrdersTab, string> = {
  all: "All",
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed"
};

const ORDERS_PAGE_LIMIT = 40;

const TABLE_OVERRIDE_VALUES = [
  "PLACED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED"
] as const;

const DELIVERY_OVERRIDE_VALUES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "rejected"
] as const;

function serializeClientTimestamp(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "seconds" in v) {
    const sec = (v as { seconds: number }).seconds;
    const ns = (v as { nanoseconds?: number }).nanoseconds ?? 0;
    if (typeof sec === "number") return new Timestamp(sec, ns).toDate().toISOString();
  }
  return null;
}

function mergeOrderPages(windowOrders: ManagerOrder[], older: ManagerOrder[]): ManagerOrder[] {
  const byId = new Map<string, ManagerOrder>();
  for (const o of older) byId.set(o.id, o);
  for (const o of windowOrders) byId.set(o.id, o);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

function docToManagerOrder(doc: QueryDocumentSnapshot): ManagerOrder {
  const d = doc.data();
  const totalAmount =
    typeof d.totalAmount === "number"
      ? d.totalAmount
      : typeof d.total === "number"
        ? d.total
        : 0;
  const email =
    typeof d.email === "string"
      ? d.email
      : typeof d.userEmail === "string"
        ? d.userEmail
        : typeof d.customerEmail === "string"
          ? d.customerEmail
          : "";
  const address =
    typeof d.address === "string"
      ? d.address.trim()
      : typeof d.deliveryAddress === "string"
        ? d.deliveryAddress.trim()
        : "";
  const paymentStatus =
    typeof d.paymentStatus === "string" ? d.paymentStatus.toLowerCase().trim() : "";
  const paymentMethod =
    typeof d.paymentMethod === "string" ? d.paymentMethod.toLowerCase().trim() : "";
  const orderType = typeof d.orderType === "string" ? d.orderType : "";
  const tableNumber = typeof d.tableNumber === "number" && Number.isFinite(d.tableNumber) ? d.tableNumber : undefined;
  const tableId = typeof d.tableId === "string" ? d.tableId.trim() : undefined;
  const tokenNumber =
    typeof d.tokenNumber === "number" && Number.isFinite(d.tokenNumber) ? d.tokenNumber : undefined;
  const tableName = typeof d.tableName === "string" ? d.tableName.trim() : undefined;

  return {
    id: doc.id,
    customerName: String(d.customerName ?? ""),
    phone: String(d.phone ?? ""),
    email: email || undefined,
    items: Array.isArray(d.items) ? d.items : [],
    totalAmount,
    status: String(d.status ?? ""),
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    address: address || undefined,
    createdAt: serializeClientTimestamp(d.createdAt),
    orderType: orderType || undefined,
    tableNumber,
    tableId: tableId || undefined,
    tokenNumber,
    tableName: tableName || undefined
  };
}

function buildOrdersQuery(db: ReturnType<typeof getFirebaseDb>, cursor?: QueryDocumentSnapshot | null) {
  const col = collection(db, "orders");
  const pageAfter = cursor ? [startAfter(cursor)] : [];
  return query(col, orderBy("createdAt", "desc"), ...pageAfter, limit(ORDERS_PAGE_LIMIT));
}

function lineQty(o: OrderItem): number {
  if (typeof o.quantity === "number" && o.quantity > 0) return o.quantity;
  if (typeof o.qty === "number" && o.qty > 0) return o.qty;
  return 1;
}

function formatItemsSummary(items: unknown[]): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    if (raw && typeof raw === "object") {
      const o = raw as OrderItem;
      const name = String(o.name ?? o.id ?? "Item");
      const qty = lineQty(o);
      const price = typeof o.price === "number" ? o.price : null;
      if (price != null) return `${name} × ${qty} · Rs. ${price}`;
      return `${name} × ${qty}`;
    }
    return String(raw);
  });
}

function formatDateTime(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  };
}

function isTerminalForActions(order: ManagerOrder): boolean {
  const b = getManagerOrderVisualBucket(order);
  return b === "cancelled" || b === "completed";
}

function delayChipClass(sev: ManagerDelaySeverity): string {
  if (sev === "critical") {
    return "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100";
  }
  if (sev === "warn") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300";
}

function ManagerOrderCard({
  order,
  busy,
  highlight,
  onPatchOverride,
  onCancel
}: {
  order: ManagerOrder;
  busy: boolean;
  highlight: boolean;
  onPatchOverride: (id: string, overrideStatus: string) => void;
  onCancel: (order: ManagerOrder) => void;
}) {
  const [overridePick, setOverridePick] = useState(order.status ?? "");
  useEffect(() => {
    setOverridePick(order.status ?? "");
  }, [order.status, order.id]);

  const bucket = getManagerOrderVisualBucket(order);
  const ageMin = orderAgeMinutesFromIso(order.createdAt ?? undefined);
  const delaySev = managerOrderDelaySeverity(bucket, ageMin);
  const isTable = String(order.orderType ?? "").toLowerCase() === "table";
  const isPosDineIn = isWaiterPosDineInOrder({
    orderType: order.orderType,
    tokenNumber: order.tokenNumber
  });
  const preset = isTable ? TABLE_OVERRIDE_VALUES : isPosDineIn ? (["pending", "preparing", "done", "served"] as const) : DELIVERY_OVERRIDE_VALUES;
  const cur = (order.status ?? "").trim();
  const presetList = [...preset] as string[];
  const options: { value: string; label: string }[] = presetList.map((v) => ({ value: v, label: v }));
  if (cur && !presetList.includes(cur)) {
    options.unshift({ value: cur, label: `${cur} (current)` });
  }
  const terminal = isTerminalForActions(order);
  const amt = order.totalAmount ?? order.total ?? 0;
  const lines = formatItemsSummary(order.items ?? []);
  const dt = formatDateTime(order.createdAt ?? undefined);

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md transition hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 ${
        highlight ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""
      }`}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400" title={order.id}>
              {order.id.length > 22 ? `${order.id.slice(0, 12)}…${order.id.slice(-8)}` : order.id}
            </p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">
              {isPosDineIn
                ? order.tableName?.trim() || (order.tableNumber != null ? `Table ${order.tableNumber}` : "Dine-in")
                : order.customerName?.trim() || "—"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${
                  isTable
                    ? "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50"
                    : isPosDineIn
                      ? "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/50"
                      : "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/50"
                }`}
              >
                {isTable ? (
                  <>
                    <UtensilsCrossed className="mr-1 inline h-3 w-3" aria-hidden />
                    Table
                    {order.tableNumber != null ? ` · #${order.tableNumber}` : ""}
                  </>
                ) : isPosDineIn ? (
                  <>
                    <UtensilsCrossed className="mr-1 inline h-3 w-3" aria-hidden />
                    POS
                    {order.tokenNumber != null ? ` · #${order.tokenNumber}` : ""}
                  </>
                ) : (
                  "Delivery / other"
                )}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600">
                {order.status || "—"}
              </span>
            </div>
          </div>
          {ageMin != null ? (
            <div
              className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${delayChipClass(delaySev)}`}
              title="Age since createdAt (rough SLA signal — not per-stage timestamps)"
            >
              {delaySev !== "none" ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
              {Math.round(ageMin)}m
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-3 px-4 py-3">
        {order.address?.trim() ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">{order.address.trim()}</p>
        ) : null}

        <div className="min-h-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Items</p>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul className="max-h-36 space-y-1 overflow-y-auto text-sm text-slate-800 dark:text-slate-100">
              {lines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              Rs. {amt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>
          {dt ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {dt.date} · {dt.time}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Override status</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={overridePick}
              disabled={busy || terminal}
              onChange={(e) => setOverridePick(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || terminal || !overridePick || overridePick === (order.status ?? "")}
              onClick={() => onPatchOverride(order.id, overridePick)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-orange-600 dark:hover:bg-orange-500"
            >
              Apply
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={busy || terminal}
          onClick={() => onCancel(order)}
          className="w-full rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
        >
          Cancel order
        </button>

        {busy ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" aria-hidden />
            Updating…
          </div>
        ) : null}
      </div>
    </article>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy aria-label="Loading orders">
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <div
          key={k}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="h-14 animate-pulse bg-slate-100 dark:bg-slate-800" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-20 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ManagerOrdersPageFeature() {
  const { user, authClaimsResolved } = useAuth();
  const [tab, setTab] = useState<ManagerOrdersTab>("all");
  const [windowOrders, setWindowOrders] = useState<ManagerOrder[]>([]);
  const [extraOrders, setExtraOrders] = useState<ManagerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [pulseIds, setPulseIds] = useState<Set<string>>(() => new Set());
  const [hasMorePages, setHasMorePages] = useState(false);

  const firstSnapRef = useRef(true);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const lastSnapDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const extraCursorRef = useRef<QueryDocumentSnapshot | null>(null);

  const displayOrders = useMemo(() => {
    const filteredWindow = windowOrders.filter((o) => managerOrderMatchesTab(o, tab));
    const filteredExtra = extraOrders.filter((o) => managerOrderMatchesTab(o, tab));
    return mergeOrderPages(filteredWindow, filteredExtra);
  }, [windowOrders, extraOrders, tab]);

  useEffect(() => {
    if (pulseIds.size === 0) return;
    const t = window.setTimeout(() => setPulseIds(new Set()), 75_000);
    return () => window.clearTimeout(t);
  }, [pulseIds]);

  useEffect(() => {
    setExtraOrders([]);
    extraCursorRef.current = null;
  }, [tab]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setLoading(false);
      setRealtimeActive(false);
      setError("Firebase is not configured.");
      return;
    }

    if (!user) {
      setWindowOrders([]);
      setExtraOrders([]);
      setLoading(false);
      setRealtimeActive(false);
      setError("Sign in to view orders.");
      return;
    }

    if (!authClaimsResolved) {
      setLoading(true);
      setRealtimeActive(false);
      setError(null);
      return;
    }

    setLoading(true);
    setRealtimeActive(false);
    setError(null);
    firstSnapRef.current = true;
    seenIdsRef.current = null;

    const db = getFirebaseDb();
    const q = buildOrdersQuery(db);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map(docToManagerOrder);
        const nextIds = new Set(snap.docs.map((d) => d.id));

        if (!firstSnapRef.current) {
          const prev = seenIdsRef.current ?? new Set();
          const newlyAdded: string[] = [];
          for (const id of nextIds) {
            if (!prev.has(id)) newlyAdded.push(id);
          }
          if (newlyAdded.length > 0) {
            setPulseIds((p) => {
              const n = new Set(p);
              newlyAdded.forEach((id) => n.add(id));
              return n;
            });
            playNewOrderChime();
          }
        } else {
          firstSnapRef.current = false;
        }
        seenIdsRef.current = nextIds;

        lastSnapDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
        setHasMorePages(snap.docs.length === ORDERS_PAGE_LIMIT);
        setWindowOrders(mapped);
        setError(null);
        setLoading(false);
        setRealtimeActive(true);
      },
      (err) => {
        console.error("[manager orders] onSnapshot", err);
        setWindowOrders([]);
        setLoading(false);
        setRealtimeActive(false);
        setError(
          (err as { code?: string }).code === "permission-denied"
            ? "No permission to read orders. Ensure your account has the admin role and Firestore rules allow access."
            : err.message || "Failed to load orders."
        );
      }
    );

    return () => unsub();
  }, [user, authClaimsResolved]);

  async function patchOverride(id: string, overrideStatus: string) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideStatus })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Failed to update order.");
      }
    } catch {
      setError("Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  }

  function confirmCancel(o: ManagerOrder) {
    if (!window.confirm("Cancel this order? Status will be set to cancelled.")) return;
    const isTable = o.orderType?.toLowerCase() === "table";
    void patchOverride(o.id, isTable ? "CANCELLED" : "cancelled");
  }

  async function loadMoreOrders() {
    const cursor = extraCursorRef.current ?? lastSnapDocRef.current;
    if (!cursor) return;
    const db = getFirebaseDb();
    setLoadingMore(true);
    setError(null);
    try {
      const q = buildOrdersQuery(db, cursor);
      const snap = await withRetry(() => getDocs(q), { maxAttempts: 3 });
      const mapped = snap.docs.map(docToManagerOrder);
      setExtraOrders((prev) => [...prev, ...mapped]);
      extraCursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMorePages(snap.docs.length === ORDERS_PAGE_LIMIT);
    } catch (e) {
      console.error("[manager orders] loadMore", e);
      setError("Could not load more orders.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Live operations</h2>
            {realtimeActive && !error ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            All orders, newest first. Filters match dine-in and delivery shapes (placed → preparing → ready → completed).
            SLA chips use order age from <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">createdAt</code>.
            Overrides and cancel use the admin API (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">overrideStatus</code>).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Filter</span>
          <div
            className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/80"
            role="tablist"
            aria-label="Order stage filter"
          >
            {TAB_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === key
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {TAB_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && displayOrders.length === 0 && !error ? <GridSkeleton /> : null}

      {!loading && !error && displayOrders.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No orders for this filter.</p>
      ) : null}

      {displayOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayOrders.map((order) => (
            <ManagerOrderCard
              key={order.id}
              order={order}
              busy={updatingId === order.id}
              highlight={pulseIds.has(order.id)}
              onPatchOverride={(id, s) => void patchOverride(id, s)}
              onCancel={confirmCancel}
            />
          ))}
        </div>
      ) : null}

      {displayOrders.length > 0 && hasMorePages ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMoreOrders()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Load more orders"
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
