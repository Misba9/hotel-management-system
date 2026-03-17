"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildAuthHeaders } from "@/lib/user-session";

type OrderHistory = {
  id: string;
  trackingId?: string;
  trackingToken?: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("nausheen_orders_cache");
    if (raw) {
      setOrders(JSON.parse(raw) as OrderHistory[]);
    }

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/user/orders", { headers });
        const payload = (await res.json()) as { success?: boolean; items?: OrderHistory[]; error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? "Failed to fetch orders.");
        }
        const items = payload.items ?? [];
        setOrders(items);
        window.localStorage.setItem("nausheen_orders_cache", JSON.stringify(items));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to fetch orders.");
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Order History</h1>
      {loading ? <p className="text-sm text-slate-500">Loading orders...</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          No orders yet. Place your first order from menu.
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-semibold">{order.id}</p>
            <p className="text-sm text-gray-500">Rs. {order.amount}</p>
            <p className="text-sm">{order.status}</p>
            <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
            {order.address ? <p className="mt-1 text-xs text-slate-500">To: {order.address}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={
                  order.trackingId
                    ? `/tracking?trackingId=${encodeURIComponent(order.trackingId)}${order.trackingToken ? `&t=${encodeURIComponent(order.trackingToken)}` : ""}`
                    : `/tracking?trackingId=${encodeURIComponent(order.id)}`
                }
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Track
              </Link>
              <Link href="/menu" className="rounded-lg border px-3 py-1.5 text-xs font-medium dark:border-slate-700">
                Reorder
              </Link>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
