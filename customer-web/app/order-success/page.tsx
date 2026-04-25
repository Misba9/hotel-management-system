"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Package } from "lucide-react";
import { OrderStatusTracker } from "@/components/orders/order-status-tracker";
import { ORDER_SUCCESS_STORAGE_KEY, type OrderSuccessSnapshot } from "@/lib/order-success-storage";

export default function OrderSuccessPage() {
  const [snapshot, setSnapshot] = useState<OrderSuccessSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(ORDER_SUCCESS_STORAGE_KEY) : null;
    if (!raw) {
      setSnapshot(null);
      return;
    }
    try {
      setSnapshot(JSON.parse(raw) as OrderSuccessSnapshot);
    } catch {
      setSnapshot(null);
    }
  }, []);

  if (snapshot === undefined) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">No order to show</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Place an order from checkout to see your confirmation here.
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-400"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const placedDate = new Date(snapshot.placedAt);

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-6 sm:pt-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20">
        <div className="bg-gradient-to-br from-emerald-500/15 via-white to-amber-500/10 px-6 pb-6 pt-8 dark:from-emerald-900/20 dark:via-slate-900 dark:to-amber-900/10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10 dark:bg-emerald-500/20 dark:ring-emerald-500/20">
              <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Order Placed Successfully
            </h1>
            <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
              Thank you! We&apos;ve received your order and will prepare it shortly.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-100 px-5 py-6 dark:border-slate-800">
          <OrderStatusTracker
            orderId={snapshot.orderId}
            trackingToken={snapshot.trackingToken}
            initialStatus="pending"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Order ID</span>
            <span className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100 sm:text-sm">{snapshot.orderId}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Placed</span>
            <time dateTime={snapshot.placedAt} className="text-slate-800 dark:text-slate-200">
              {placedDate.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
              })}
            </time>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Payment</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Cash on delivery
            </span>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Items</h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.items.map((line) => (
                <li key={line.id} className="flex justify-between gap-3 py-3 text-sm first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{line.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Rs. {line.price} × {line.qty}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">Rs. {line.lineTotal}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-base font-semibold text-slate-900 dark:text-slate-50">Total</span>
            <span className="text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">Rs. {snapshot.totalAmount}</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/50">
          <Link
            href={`/orders/${encodeURIComponent(snapshot.orderId)}`}
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Open live progress
          </Link>
          <Link
            href="/menu"
            className="flex w-full items-center justify-center rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 active:scale-[0.99] dark:bg-orange-500 dark:hover:bg-orange-400"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
