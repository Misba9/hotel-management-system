import { useEffect, useMemo, useState } from "react";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { getStaffDesktopFirestore } from "@/lib/firebase";
import { useOrders } from "@shared/hooks/useOrders";

function formatPrice(amount: number | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `₹${amount.toFixed(2)}`;
}

export function ManagerDashboard() {
  const { logout } = useAuth();
  const { status, syncNow } = useOfflineSync();
  const [db, setDb] = useState<Awaited<ReturnType<typeof getStaffDesktopFirestore>>>(null);
  const { orders, loading } = useOrders(db, { pageSize: 100 });

  useEffect(() => {
    void getStaffDesktopFirestore().then(setDb);
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter((order) => {
      const created = order.raw.createdAt;
      if (!created || typeof created !== "object") return false;
      const ts = created as { toDate?: () => Date };
      const date = typeof ts.toDate === "function" ? ts.toDate() : null;
      return date ? date >= today : false;
    });
    const revenue = todayOrders.reduce(
      (sum, order) => sum + (order.totalAmount ?? order.total ?? 0),
      0
    );
    const pending = orders.filter((order) => {
      const statusValue = (order.status ?? "").toLowerCase();
      return ["pending", "accepted", "preparing", "ready", "confirmed"].includes(statusValue);
    }).length;
    return { todayCount: todayOrders.length, revenue, pending };
  }, [orders]);

  return (
    <DesktopAppShell title="Manager Overview" subtitle="Operations dashboard" onLogout={() => void logout()}>
      <div className="h-full overflow-y-auto p-5">
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Today's Orders" value={String(stats.todayCount)} tone="teal" />
          <StatCard label="Today's Revenue" value={formatPrice(stats.revenue)} tone="emerald" />
          <StatCard label="Active / Pending" value={String(stats.pending)} tone="amber" />
          <StatCard
            label="Offline Queue"
            value={String(status.pendingCount)}
            tone={status.pendingCount > 0 ? "orange" : "slate"}
            action={
              status.pendingCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="mt-2 text-xs font-bold text-brand-teal underline"
                >
                  Sync now
                </button>
              ) : null
            }
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-800">Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Loading orders…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const token =
                      typeof order.raw.tokenNumber === "number"
                        ? `#${order.raw.tokenNumber}`
                        : `#${order.id.slice(-8)}`;
                    return (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-semibold">{token}</td>
                      <td className="px-5 py-3">{order.orderType ?? "—"}</td>
                      <td className="px-5 py-3">{order.status ?? "—"}</td>
                      <td className="px-5 py-3">{order.paymentStatus ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-bold text-brand-teal">
                        {formatPrice(order.totalAmount ?? order.total)}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DesktopAppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  action
}: {
  label: string;
  value: string;
  tone: "teal" | "emerald" | "amber" | "orange" | "slate";
  action?: React.ReactNode;
}) {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    slate: "border-slate-200 bg-white text-slate-800"
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      {action}
    </div>
  );
}
