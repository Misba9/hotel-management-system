"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { ChevronDown, Loader2, Package } from "lucide-react";
import { auth, db } from "@shared/firebase/client";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

type OrderItem = {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
};

export type Order = {
  id: string;
  customerName?: string;
  phone?: string;
  items?: unknown[];
  totalAmount?: number;
  total?: number;
  status?: string;
  orderType?: string;
  paymentMethod?: string;
  createdAt?: string | null;
  userId?: string;
};

/** Canonical workflow statuses written by admin. Legacy docs may still use older values. */
export type WorkflowStatus = "pending" | "preparing" | "completed";

const WORKFLOW_STATUSES: WorkflowStatus[] = ["pending", "preparing", "completed"];

const STATUS_FILTER = ["all", "pending", "preparing", "completed"] as const;

type UiOrderStatus = "pending" | "preparing" | "completed" | "cancelled" | "other";

const STATUS_BADGE: Record<UiOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-900 ring-amber-200",
  preparing: "bg-sky-50 text-sky-900 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  other: "bg-slate-100 text-slate-800 ring-slate-200"
};

const STATUS_LABEL: Record<UiOrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
  other: "Other"
};

const ORDERS_REALTIME_LIMIT = 100;

function toUiStatus(raw: string | undefined): UiOrderStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "pending") return "pending";
  if (s === "preparing") return "preparing";
  if (["completed", "delivered", "ready", "out_for_delivery"].includes(s)) return "completed";
  if (s === "cancelled") return "cancelled";
  return "other";
}

function matchesStatusFilter(order: Order, filter: string): boolean {
  if (filter === "all") return true;
  const ui = toUiStatus(order.status);
  if (filter === "pending") return ui === "pending";
  if (filter === "preparing") return ui === "preparing";
  if (filter === "completed") return ui === "completed";
  return true;
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

function docToOrder(doc: QueryDocumentSnapshot): Order {
  const d = doc.data();
  const totalAmount =
    typeof d.totalAmount === "number"
      ? d.totalAmount
      : typeof d.total === "number"
        ? d.total
        : 0;
  return {
    id: doc.id,
    customerName: String(d.customerName ?? ""),
    phone: String(d.phone ?? ""),
    items: Array.isArray(d.items) ? d.items : [],
    totalAmount,
    status: String(d.status ?? "pending"),
    createdAt: serializeClientTimestamp(d.createdAt)
  };
}

function formatItemsSummary(items: unknown[]): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    if (raw && typeof raw === "object") {
      const o = raw as OrderItem;
      const name = String(o.name ?? o.id ?? "Item");
      const qty = typeof o.quantity === "number" && o.quantity > 0 ? o.quantity : 1;
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
  const ui = toUiStatus(status);
  const cls = STATUS_BADGE[ui];
  const label = STATUS_LABEL[ui];
  return (
    <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`} title={label}>
      {label}
    </span>
  );
}

function OrderStatusControls({
  order,
  busy,
  onSetStatus
}: {
  order: Order;
  busy: boolean;
  onSetStatus: (id: string, next: WorkflowStatus) => void;
}) {
  const current = toUiStatus(order.status);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Order status">
      {WORKFLOW_STATUSES.map((s) => {
        const active = current === s;
        const ring =
          s === "pending"
            ? active
              ? "bg-amber-400 text-amber-950 ring-2 ring-amber-500 ring-offset-1"
              : "bg-amber-100 text-amber-900 hover:bg-amber-200"
            : s === "preparing"
              ? active
                ? "bg-sky-500 text-white ring-2 ring-sky-600 ring-offset-1"
                : "bg-sky-100 text-sky-900 hover:bg-sky-200"
              : active
                ? "bg-emerald-500 text-white ring-2 ring-emerald-600 ring-offset-1"
                : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200";
        return (
          <button
            key={s}
            type="button"
            disabled={busy || active}
            onClick={() => onSetStatus(order.id, s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition disabled:cursor-default disabled:opacity-100 ${ring}`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

function OrderItemsBlock({ items }: { items: unknown[] }) {
  const lines = useMemo(() => formatItemsSummary(items), [items]);
  if (lines.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <ul className="max-h-32 space-y-1 overflow-y-auto text-sm leading-snug text-slate-700">
      {lines.map((line, i) => (
        <li key={i} className="border-b border-slate-100 pb-1 last:border-0 last:pb-0">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function OrdersPageFeature() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [source, setSource] = useState<"realtime" | "rest">("realtime");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;

  const filteredOrders = useMemo(
    () => allOrders.filter((o) => matchesStatusFilter(o, statusFilter)),
    [allOrders, statusFilter]
  );

  const loadOrders = useCallback(async (nextStatus: string, append = false, cursorValue?: string | null) => {
    setLoading(true);
    setError(null);
    if (!append) setAllOrders([]);
    const params = new URLSearchParams({
      status: nextStatus,
      limit: "40"
    });
    if (append && cursorValue) params.set("cursor", cursorValue);
    try {
      const res = await adminApiFetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        setError("Failed to load orders.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { items: Order[]; hasMore?: boolean; nextCursor?: string | null };
      setAllOrders((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
      setHasMore(Boolean(data.hasMore));
      setCursor(data.nextCursor ?? null);
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (source !== "rest") return;
    setCursor(null);
    void loadOrders(statusFilter, false);
  }, [statusFilter, source, loadOrders]);

  useEffect(() => {
    if (source !== "realtime") return;

    let unsubOrders: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubOrders?.();
      if (!user) {
        setAllOrders([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(ORDERS_REALTIME_LIMIT));
      unsubOrders = onSnapshot(
        q,
        (snap) => {
          setAllOrders(snap.docs.map(docToOrder));
          setError(null);
          setLoading(false);
        },
        (err) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("Orders realtime listener:", err);
          }
          setSource("rest");
          setError("Real-time sync unavailable. Using API.");
          void loadOrders(statusFilterRef.current, false);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubOrders?.();
    };
  }, [source, loadOrders]);

  async function patchOrder(id: string, payload: { status?: WorkflowStatus; refund?: boolean; refundReason?: string }) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError("Failed to update order.");
        return;
      }
      if (source === "rest") {
        setCursor(null);
        await loadOrders(statusFilter, false);
      }
    } catch {
      setError("Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  }

  function setWorkflowStatus(id: string, next: WorkflowStatus) {
    void patchOrder(id, { status: next });
  }

  const displayList = filteredOrders;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h2>
          <p className="mt-1 text-sm text-slate-600">
            {source === "realtime" ? (
              <>
                Real-time sync · last {ORDERS_REALTIME_LIMIT} orders · newest first
              </>
            ) : (
              <>Loaded via API · newest first</>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <label htmlFor="order-status-filter" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Filter
          </label>
          <div className="relative">
            <select
              id="order-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-slate-900 shadow-sm outline-none ring-brand-primary/20 focus:border-brand-primary focus:ring-2 sm:min-w-[200px]"
            >
              {STATUS_FILTER.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All orders" : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          </div>
        </div>
      </div>

      <RequestState
        error={error}
        loading={loading && displayList.length === 0}
        empty={!loading && displayList.length === 0}
        loadingMessage="Loading orders…"
        emptyMessage="No orders match this filter."
      />

      {displayList.length > 0 ? (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="min-w-[200px] px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayList.map((order) => {
                  const dt = formatDateTime(order.createdAt ?? undefined);
                  const amt = order.totalAmount ?? order.total ?? 0;
                  const busy = updatingId === order.id;
                  return (
                    <tr key={order.id} className="align-top hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{order.customerName?.trim() || "—"}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{order.id.slice(0, 12)}…</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{order.phone?.trim() || "—"}</td>
                      <td className="px-4 py-3">
                        <OrderItemsBlock items={order.items ?? []} />
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">Rs. {amt}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status ?? ""} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {dt ? (
                          <>
                            <div className="text-sm">{dt.date}</div>
                            <div className="text-xs text-slate-500">{dt.time}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col items-end gap-2">
                          <OrderStatusControls order={order} busy={busy} onSetStatus={setWorkflowStatus} />
                          <button
                            type="button"
                            onClick={() => void patchOrder(order.id, { refund: true, refundReason: "manual_admin_refund" })}
                            className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                            disabled={busy}
                          >
                            Refund
                          </button>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-primary" aria-hidden /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {displayList.length > 0 ? (
        <div className="space-y-4 md:hidden">
          {displayList.map((order) => {
            const dt = formatDateTime(order.createdAt ?? undefined);
            const amt = order.totalAmount ?? order.total ?? 0;
            const busy = updatingId === order.id;
            const lines = formatItemsSummary(order.items ?? []);
            return (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{order.customerName?.trim() || "—"}</p>
                      <p className="text-sm tabular-nums text-slate-600">{order.phone?.trim() || "—"}</p>
                    </div>
                    <StatusBadge status={order.status ?? ""} />
                  </div>
                  {dt ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {dt.date} · {dt.time}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                    {lines.length === 0 ? (
                      <p className="text-sm text-slate-400">—</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm text-slate-800">
                        {lines.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs font-medium uppercase text-slate-500">Total</span>
                    <span className="text-lg font-bold tabular-nums text-slate-900">Rs. {amt}</span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">ID: {order.id}</p>
                  <OrderStatusControls order={order} busy={busy} onSetStatus={setWorkflowStatus} />
                  <button
                    type="button"
                    onClick={() => void patchOrder(order.id, { refund: true, refundReason: "manual_admin_refund" })}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50"
                    disabled={busy}
                  >
                    Refund
                  </button>
                  {busy ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-primary" aria-hidden />
                      Updating…
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {source === "rest" && hasMore && displayList.length > 0 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadOrders(statusFilter, true, cursor)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}
