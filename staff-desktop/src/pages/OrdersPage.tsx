import { useEffect, useState } from "react";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useCashierOrdersSubscription, useCashierOrders } from "@/hooks/use-cashier-orders";
import { resolveOrderSource } from "@/lib/pos/order-source";

function formatPrice(n: number) {
  return `₹${n.toFixed(2)}`;
}

export function OrdersPage() {
  const { logout } = useAuth();
  useCashierOrdersSubscription(true);
  const { allOrders, loading } = useCashierOrders();
  const [filter, setFilter] = useState<string>("all");

  const filtered = allOrders.filter((o) => filter === "all" || resolveOrderSource(o) === filter);

  return (
    <DesktopAppShell title="Orders Hub" subtitle="All channels · Swiggy · Zomato · Online" onLogout={() => void logout()}>
      <div className="flex h-full flex-col p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {["all", "parcel", "swiggy", "zomato", "online", "waiter", "dine_in"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${filter === f ? "bg-brand-teal text-white" : "bg-white dark:bg-slate-800"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-3">Token</th>
                <th>Source</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Customer</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="border-t dark:border-slate-800">
                    <td className="px-4 py-3 font-mono">#{o.tokenNumber ?? o.id.slice(-6)}</td>
                    <td>{resolveOrderSource(o)}</td>
                    <td className="capitalize">{o.canonicalStatus}</td>
                    <td>{o.paymentStatus ?? "—"}</td>
                    <td>{o.customer?.name ?? "—"}</td>
                    <td className="font-bold">{formatPrice(o.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DesktopAppShell>
  );
}
