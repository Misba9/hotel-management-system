"use client";

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
  where,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { Loader2, Mail, MapPin, Package, Phone } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { playNewOrderChime } from "@/lib/new-order-chime";
import { useAuth } from "@/context/AuthContext";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { withRetry } from "@shared/utils/retry";

type OrderItem = {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  qty?: number;
};

export type Order = {
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
};

/** Status values the admin API may set (server uses Admin SDK merge — bypasses strict client rules). */
export type AdminOrderStatusAction =
  | "accepted"
  | "rejected"
  | "preparing"
  | "out_for_delivery"
  | "delivered";

const TAB_FILTERS = ["all", "pending", "preparing", "delivered"] as const;
type TabFilter = (typeof TAB_FILTERS)[number];

/** Bounded realtime window per tab; use “Load more” for additional pages. */
const ORDERS_PAGE_LIMIT = 40;

const TAB_LABEL: Record<TabFilter, string> = {
  all: "All",
  pending: "Pending",
  preparing: "Preparing",
  delivered: "Delivered"
};

type BadgeKey =
  | "pending"
  | "accepted"
  | "rejected"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "other";

const BADGE: Record<BadgeKey, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-50 text-yellow-900 ring-yellow-200" },
  accepted: { label: "Accepted", className: "bg-blue-50 text-blue-900 ring-blue-200" },
  rejected: { label: "Rejected", className: "bg-rose-50 text-rose-900 ring-rose-200" },
  preparing: { label: "Preparing", className: "bg-orange-50 text-orange-900 ring-orange-200" },
  ready: { label: "Ready", className: "bg-violet-50 text-violet-900 ring-violet-200" },
  out_for_delivery: { label: "Out for delivery", className: "bg-cyan-50 text-cyan-900 ring-cyan-200" },
  delivered: { label: "Delivered", className: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  other: { label: "Other", className: "bg-slate-100 text-slate-800 ring-slate-200" }
};

function toBadgeKey(raw: string | undefined): BadgeKey {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "pending" || s === "created" || s === "confirmed") return "pending";
  if (s === "accepted") return "accepted";
  if (s === "rejected") return "rejected";
  if (s === "preparing") return "preparing";
  if (s === "ready") return "ready";
  if (s === "out_for_delivery" || s === "picked_up") return "out_for_delivery";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "other";
}

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

function mergeAdminOrderPages(windowOrders: Order[], older: Order[]): Order[] {
  const byId = new Map<string, Order>();
  for (const o of older) byId.set(o.id, o);
  for (const o of windowOrders) byId.set(o.id, o);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

function docToOrder(doc: QueryDocumentSnapshot): Order {
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

  return {
    id: doc.id,
    customerName: String(d.customerName ?? ""),
    phone: String(d.phone ?? ""),
    email: email || undefined,
    items: Array.isArray(d.items) ? d.items : [],
    totalAmount,
    status: String(d.status ?? "pending"),
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    address: address || undefined,
    createdAt: serializeClientTimestamp(d.createdAt)
  };
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

function StatusBadge({ status }: { status: string }) {
  const key = toBadgeKey(status);
  const b = BADGE[key];
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${b.className}`}
      title={b.label}
    >
      {b.label}
    </span>
  );
}

function PaymentStatusBadge({ order }: { order: Order }) {
  const ps = (order.paymentStatus ?? "").toLowerCase();
  const pm = (order.paymentMethod ?? "").toLowerCase();
  if (ps === "paid") {
    return (
      <span
        className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60"
        title="Payment received"
      >
        Paid
      </span>
    );
  }
  if (pm === "cod") {
    return (
      <span
        className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
        title="Cash on delivery"
      >
        COD
      </span>
    );
  }
  if (ps === "pending" || !ps) {
    return (
      <span
        className="inline-flex max-w-full truncate rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
        title="Online payment not completed"
      >
        Unpaid
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

function AddressSnippet({ text }: { text: string | undefined }) {
  if (!text?.trim()) {
    return <span className="text-slate-400">—</span>;
  }
  const t = text.trim();
  const short = t.length > 72 ? `${t.slice(0, 70)}…` : t;
  return (
    <p className="flex items-start gap-1.5 text-sm leading-snug text-slate-700 dark:text-slate-200" title={t}>
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <span>{short}</span>
    </p>
  );
}

function buildOrdersQuery(
  db: ReturnType<typeof getFirebaseDb>,
  tab: TabFilter,
  cursor?: QueryDocumentSnapshot | null
) {
  const col = collection(db, "orders");
  const lim = ORDERS_PAGE_LIMIT;
  const pageAfter = cursor ? [startAfter(cursor)] : [];
  switch (tab) {
    case "all":
      return query(col, orderBy("createdAt", "desc"), ...pageAfter, limit(lim));
    case "pending":
      return query(
        col,
        where("status", "in", ["pending", "accepted"]),
        orderBy("createdAt", "desc"),
        ...pageAfter,
        limit(lim)
      );
    case "preparing":
      return query(
        col,
        where("status", "in", ["preparing", "ready", "out_for_delivery"]),
        orderBy("createdAt", "desc"),
        ...pageAfter,
        limit(lim)
      );
    case "delivered":
      return query(col, where("status", "==", "delivered"), orderBy("createdAt", "desc"), ...pageAfter, limit(lim));
    default:
      return query(col, orderBy("createdAt", "desc"), ...pageAfter, limit(lim));
  }
}

function statusActionButtons(status: string | undefined): {
  key: string;
  label: string;
  next: AdminOrderStatusAction;
  variant: "primary" | "danger";
}[] {
  const s = (status ?? "pending").toLowerCase();
  switch (s) {
    case "pending":
      return [
        { key: "accept", label: "Accept", next: "accepted", variant: "primary" },
        { key: "reject", label: "Reject", next: "rejected", variant: "danger" }
      ];
    case "accepted":
      return [{ key: "prep", label: "Preparing", next: "preparing", variant: "primary" }];
    case "preparing":
    case "ready":
      return [{ key: "ofd", label: "Out for delivery", next: "out_for_delivery", variant: "primary" }];
    case "out_for_delivery":
      return [{ key: "done", label: "Delivered", next: "delivered", variant: "primary" }];
    default:
      return [];
  }
}

function isFinalStatus(status: string | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return ["delivered", "rejected", "cancelled", "canceled"].includes(s);
}

function btnClass(enabled: boolean, variant: "primary" | "danger"): string {
  const base =
    "rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed";
  if (!enabled) return `${base} cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80`;
  if (variant === "danger") {
    return `${base} bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500`;
  }
  return `${base} bg-orange-500 text-white hover:bg-orange-600 focus-visible:outline-orange-500`;
}

function OrderStatusActions({
  order,
  busy,
  onSetStatus
}: {
  order: Order;
  busy: boolean;
  onSetStatus: (id: string, next: AdminOrderStatusAction) => void;
}) {
  const final = isFinalStatus(order.status);
  const buttons = statusActionButtons(order.status);

  if (final || buttons.length === 0) {
    return (
      <p className="text-xs text-slate-400" title="No further actions for this order">
        {final ? "Final — no actions" : "—"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2" role="group" aria-label="Update order status">
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={busy}
          onClick={() => onSetStatus(order.id, b.next)}
          className={btnClass(!busy, b.variant)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function CustomerContact({ order }: { order: Order }) {
  return (
    <div className="space-y-1 text-sm">
      {order.phone?.trim() ? (
        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="tabular-nums">{order.phone.trim()}</span>
        </p>
      ) : (
        <p className="text-slate-400">—</p>
      )}
      {order.email?.trim() ? (
        <p className="flex items-center gap-1.5 break-all text-slate-600 dark:text-slate-300">
          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>{order.email.trim()}</span>
        </p>
      ) : null}
    </div>
  );
}

function OrdersGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading orders"
    >
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <div
          key={k}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="h-14 animate-pulse bg-slate-100 dark:bg-slate-800" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-20 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800/80" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({
  order,
  busy,
  highlight,
  onSetStatus,
  onRefund
}: {
  order: Order;
  busy: boolean;
  highlight: boolean;
  onSetStatus: (id: string, next: AdminOrderStatusAction) => void;
  onRefund: (id: string) => void;
}) {
  const amt = order.totalAmount ?? order.total ?? 0;
  const lines = formatItemsSummary(order.items ?? []);
  const dt = formatDateTime(order.createdAt ?? undefined);

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md transition hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 ${
        highlight
          ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
          : ""
      }`}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400" title={order.id}>
              {order.id.length > 22 ? `${order.id.slice(0, 12)}…${order.id.slice(-8)}` : order.id}
            </p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{order.customerName?.trim() || "—"}</p>
            <CustomerContact order={order} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={order.status ?? ""} />
            <PaymentStatusBadge order={order} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-3 px-4 py-3">
        {order.address?.trim() ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Address</p>
            <AddressSnippet text={order.address} />
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Items</p>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-800 dark:text-slate-100">
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

        <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
          <OrderStatusActions order={order} busy={busy} onSetStatus={onSetStatus} />
        </div>

        <button
          type="button"
          onClick={() => onRefund(order.id)}
          className="w-full rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
          disabled={busy || isFinalStatus(order.status)}
        >
          Refund
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

export function OrdersPageFeature() {
  const { user, authClaimsResolved } = useAuth();
  const [tab, setTab] = useState<TabFilter>("all");
  const [windowOrders, setWindowOrders] = useState<Order[]>([]);
  const [extraOrders, setExtraOrders] = useState<Order[]>([]);
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

  const displayOrders = useMemo(() => mergeAdminOrderPages(windowOrders, extraOrders), [windowOrders, extraOrders]);

  useEffect(() => {
    if (pulseIds.size === 0) return;
    const t = window.setTimeout(() => setPulseIds(new Set()), 75_000);
    return () => window.clearTimeout(t);
  }, [pulseIds]);

  useEffect(() => {
    firstSnapRef.current = true;
    seenIdsRef.current = null;
  }, [tab]);

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

    const db = getFirebaseDb();
    const q = buildOrdersQuery(db, tab);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map(docToOrder);
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
        console.error("[orders page] onSnapshot", err);
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
  }, [user, authClaimsResolved, tab]);

  async function patchOrder(
    id: string,
    payload: { status?: AdminOrderStatusAction; refund?: boolean; refundReason?: string }
  ) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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

  function applyStatusUpdate(id: string, next: AdminOrderStatusAction) {
    void patchOrder(id, { status: next });
  }

  async function loadMoreOrders() {
    const cursor = extraCursorRef.current ?? lastSnapDocRef.current;
    if (!cursor) return;
    const db = getFirebaseDb();
    setLoadingMore(true);
    setError(null);
    try {
      const q = buildOrdersQuery(db, tab, cursor);
      const snap = await withRetry(() => getDocs(q), { maxAttempts: 3 });
      const mapped = snap.docs.map(docToOrder);
      setExtraOrders((prev) => [...prev, ...mapped]);
      extraCursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMorePages(snap.docs.length === ORDERS_PAGE_LIMIT);
    } catch {
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
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Orders</h2>
            {realtimeActive && !error ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60"
                title="Firestore onSnapshot — new orders and status changes appear instantly."
              >
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Live card grid — newest first. New orders chime and pulse briefly. Status updates use the secure admin API
            (server-side <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">updateDoc</code> merge).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Filter</span>
          <div
            className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/80"
            role="tablist"
            aria-label="Order status filter"
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

      {loading && displayOrders.length === 0 && !error ? <OrdersGridSkeleton /> : null}

      {!loading && !error && displayOrders.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No orders for this filter.</p>
      ) : null}

      {displayOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={updatingId === order.id}
              highlight={pulseIds.has(order.id)}
              onSetStatus={applyStatusUpdate}
              onRefund={(id) => void patchOrder(id, { refund: true, refundReason: "manual_admin_refund" })}
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
