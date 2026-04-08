"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { ChevronRight, Loader2, MapPin, Package } from "lucide-react";
import { withRetry } from "@shared/utils/retry";
import { db } from "@/lib/firebase";
import type { CustomerOrderListItem } from "@/lib/order-service";
import {
  USER_ORDERS_LIVE_LIMIT,
  fetchUserOrdersPage,
  subscribeToUserOrders
} from "@/lib/order-service";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/context/auth-context";
import { CANCELLABLE_ORDER_STATUSES, getOrderStatusPresentation } from "@/lib/order-status-ui";
import { buildUserHeaders } from "@/lib/user-session";

type OrderHistory = CustomerOrderListItem;

function shortOrderId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function mergeOrderLists(live: OrderHistory[], older: OrderHistory[]): OrderHistory[] {
  const liveIds = new Set(live.map((o) => o.id));
  const rest = older.filter((o) => !liveIds.has(o.id));
  return [...live, ...rest].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function OrdersAuthenticatedContent() {
  const { user } = useAuth();
  const [recentOrders, setRecentOrders] = useState<OrderHistory[]>([]);
  const [olderOrders, setOlderOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string>("");
  const [showLiveIndicator, setShowLiveIndicator] = useState(false);

  const liveLastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const olderCursorRef = useRef<QueryDocumentSnapshot | null>(null);

  const displayOrders = useMemo(() => mergeOrderLists(recentOrders, olderOrders), [recentOrders, olderOrders]);

  useEffect(() => {
    if (!user) return;
    setShowLiveIndicator(true);
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOlderOrders([]);
    olderCursorRef.current = null;
    liveLastDocRef.current = null;

    const unsub = subscribeToUserOrders(db, user.uid, {
      maxDocs: USER_ORDERS_LIVE_LIMIT,
      onData: (items) => {
        if (!cancelled) {
          setRecentOrders(items);
          setLoading(false);
          setError(null);
          setHasMoreOlder(items.length === USER_ORDERS_LIVE_LIMIT);
        }
      },
      onMeta: (lastSnap) => {
        if (!cancelled) {
          liveLastDocRef.current = lastSnap;
        }
      },
      onError: (msg) => {
        if (!cancelled) {
          setError(msg);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore) return;
    const cursor = olderCursorRef.current ?? liveLastDocRef.current;
    if (!cursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const { items, lastDoc, hasMore } = await withRetry(
        () => fetchUserOrdersPage(db, user.uid, USER_ORDERS_LIVE_LIMIT, cursor),
        { maxAttempts: 3 }
      );
      setOlderOrders((prev) => [...prev, ...items]);
      if (lastDoc) olderCursorRef.current = lastDoc;
      setHasMoreOlder(hasMore);
    } catch {
      setError("Could not load older orders. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore]);

  async function cancelOrder(orderId: string) {
    setActionMessage(null);
    setCancellingId(orderId);
    try {
      const headers = await buildUserHeaders();
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers
      });
      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to cancel order.");
      }
      setRecentOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "cancelled" } : order)));
      setOlderOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "cancelled" } : order)));
      setActionMessage("Order cancelled successfully.");
    } catch (cancelError) {
      setActionMessage(cancelError instanceof Error ? cancelError.message : "Failed to cancel order.");
    } finally {
      setCancellingId("");
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 pb-16 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">Your orders</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live updates for your recent orders. Older history loads in pages.
          </p>
        </div>
        {showLiveIndicator ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/50"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {actionMessage}
        </p>
      ) : null}

      {!loading && displayOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="mt-4 font-medium text-slate-800 dark:text-slate-100">No orders yet</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">When you place an order, it will show up here with live status.</p>
          <Link
            href="/menu"
            className="mt-6 inline-flex items-center gap-1 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Browse menu
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : null}

      <ul className="space-y-4">
        {displayOrders.map((order) => {
          const pres = getOrderStatusPresentation(order.status);
          const canCancel = CANCELLABLE_ORDER_STATUSES.has(order.status);
          const placed = new Date(order.createdAt);
          const dateStr = Number.isFinite(placed.getTime()) ? placed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

          return (
            <li
              key={order.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400" title={order.id}>
                    #{shortOrderId(order.id)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dateStr}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pres.badgeClass}`}>{pres.label}</span>
              </div>

              <div className="space-y-3 px-4 py-3">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40">
                    <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Items</p>
                    <p className="mt-0.5 text-sm leading-snug text-slate-800 dark:text-slate-100">
                      {order.itemsSummary || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">Rs. {order.amount}</p>
                    {order.paymentMethod || order.paymentStatus ? (
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {order.paymentMethod === "cod"
                          ? "Cash on delivery"
                          : order.paymentMethod === "razorpay"
                            ? "Razorpay"
                            : order.paymentMethod ?? "—"}
                        {order.paymentStatus ? (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                            · {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "pending" ? "Payment pending" : order.paymentStatus}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </div>

                {order.address ? (
                  <div className="flex gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span className="line-clamp-2">{order.address}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={
                      order.trackingId
                        ? `/tracking?trackingId=${encodeURIComponent(order.trackingId)}${order.trackingToken ? `&t=${encodeURIComponent(order.trackingToken)}` : ""}`
                        : `/tracking?trackingId=${encodeURIComponent(order.id)}`
                    }
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    Track order
                  </Link>
                  <Link
                    href="/menu"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Order again
                  </Link>
                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => void cancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                      className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {cancellingId === order.id ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!loading && hasMoreOlder ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Load older orders"
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function OrderHistoryPage() {
  return (
    <RequireAuth
      modalTitle="Sign in to view your orders"
      modalDescription="Phone OTP, email, Google, or Apple — no page reload. We’ll show your order history as soon as you’re in."
      fullPageLoginHref="/login?redirect=/orders"
      autoOpenModal
    >
      <OrdersAuthenticatedContent />
    </RequireAuth>
  );
}
