"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

type Order = {
  id: string;
  status?: string;
  total?: number;
  orderType?: string;
  paymentMethod?: string;
  createdAt?: string;
  userId?: string;
};

const statusOptions = ["all", "pending", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];

export function OrdersPageFeature() {
  const [status, setStatus] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async (nextStatus: string, append = false, cursorValue?: string | null) => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      status: nextStatus,
      limit: "30"
    });
    if (append && cursorValue) query.set("cursor", cursorValue);
    try {
      const res = await adminApiFetch(`/api/orders?${query.toString()}`);
      if (!res.ok) {
        setError("Failed to load orders.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { items: Order[]; hasMore?: boolean; nextCursor?: string | null };
      setOrders((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
      setHasMore(Boolean(data.hasMore));
      setCursor(data.nextCursor ?? null);
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCursor(null);
    void loadOrders(status, false);
  }, [status, loadOrders]);

  async function updateOrder(id: string, payload: { status?: string; refund?: boolean; refundReason?: string }) {
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
        setUpdatingId(null);
        return;
      }
      setCursor(null);
      await loadOrders(status, false);
    } catch {
      setError("Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Order Management</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Filter by status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-3 py-2 text-sm">
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <RequestState error={error} loading={loading} empty={orders.length === 0} loadingMessage="Loading orders..." emptyMessage="No orders found." />

      {orders.map((order) => (
        <div key={order.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{order.id}</p>
              <p className="text-sm text-gray-500">
                Rs. {order.total ?? 0} • {order.orderType ?? "delivery"} • {order.paymentMethod ?? "cod"}
              </p>
              <p className="text-sm">Status: {order.status ?? "unknown"}</p>
              <p className="text-xs text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                defaultValue={order.status ?? "pending"}
                onChange={(e) => {
                  void updateOrder(order.id, { status: e.target.value });
                }}
                className="rounded border px-2 py-1 text-sm"
                disabled={updatingId === order.id}
              >
                {statusOptions.filter((option) => option !== "all").map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  void updateOrder(order.id, { refund: true, refundReason: "manual_admin_refund" });
                }}
                className="rounded border px-3 py-1 text-sm text-red-600"
                disabled={updatingId === order.id}
              >
                Refund
              </button>
            </div>
          </div>
        </div>
      ))}
      {hasMore ? (
        <button
          onClick={() => {
            void loadOrders(status, true, cursor);
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          Load more orders
        </button>
      ) : null}
    </section>
  );
}
