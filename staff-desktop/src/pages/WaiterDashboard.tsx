import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useTables, type FloorTable } from "@/hooks/use-tables";
import { useWaiterFloorOrders } from "@/hooks/use-waiter-floor-orders";
import { subscribeWaiterOrders, markCashierOrderPaid, type StaffOrderRow } from "@/services/orders";
import { requestTableOrderBill } from "@/services/request-table-order-bill";
import { markTableOrderServed } from "@/services/mark-table-order-served";
import { useEffect } from "react";
import { Modal } from "@/components/modals/Modal";

function formatPrice(amount: number | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `₹${amount.toFixed(2)}`;
}

function tableLabel(table: FloorTable): string {
  return table.displayName ?? `Table ${table.number}`;
}

export function WaiterDashboard() {
  const { logout } = useAuth();
  const { tables, loading: tablesLoading } = useTables(true);
  const { statusByTableNumber } = useWaiterFloorOrders(true);
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tab, setTab] = useState<"tables" | "orders" | "history">("tables");
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrdersLoading(true);
    const unsub = subscribeWaiterOrders(
      (list) => {
        setOrders(list);
        setOrdersLoading(false);
      },
      () => setOrdersLoading(false)
    );
    return unsub;
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((o) => !["completed", "cancelled", "delivered", "served"].includes(o.canonicalStatus)),
    [orders]
  );

  const historyOrders = useMemo(
    () => orders.filter((o) => ["completed", "served", "delivered"].includes(o.canonicalStatus)),
    [orders]
  );

  const handleRequestBill = async (orderId: string) => {
    setBusy(true);
    try {
      await requestTableOrderBill(orderId);
      setMessage("Bill requested — cashier notified");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkServed = async (orderId: string) => {
    setBusy(true);
    try {
      await markTableOrderServed(orderId);
      setMessage("Order marked served");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DesktopAppShell title="Waiter Floor" subtitle="Tables · Orders · Service" onLogout={() => void logout()}>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 gap-2 border-b bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          {(["tables", "orders", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-brand-teal text-white" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              {t}
            </button>
          ))}
          {message ? <p className="ml-auto self-center text-sm text-teal-700">{message}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "tables" ? (
            tablesLoading ? (
              <p className="text-sm text-slate-400">Loading tables…</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {tables.map((table) => {
                  const status = statusByTableNumber.get(table.number) ?? table.status;
                  const occupied = table.status === "occupied" || status === "PREPARING" || status === "READY";
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTable(table)}
                      className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
                        occupied ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20"
                      }`}
                    >
                      <p className="text-lg font-extrabold">{tableLabel(table)}</p>
                      <p className="mt-1 text-xs font-bold uppercase text-slate-500">{String(status)}</p>
                      <Link
                        to={`/waiter/order/${table.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-block rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Take order
                      </Link>
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          {tab === "orders" ? (
            ordersLoading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {activeOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex justify-between">
                      <p className="font-bold">#{order.tokenNumber ?? order.id.slice(-6)}</p>
                      <p className="font-extrabold text-brand-teal">{formatPrice(order.totalAmount)}</p>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">{order.canonicalStatus} · {order.tableName ?? "—"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => void handleMarkServed(order.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                        Served
                      </button>
                      <button type="button" disabled={busy} onClick={() => void handleRequestBill(order.id)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">
                        Request bill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {tab === "history" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="py-2">Token</th>
                  <th>Table</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.map((o) => (
                  <tr key={o.id} className="border-b dark:border-slate-800">
                    <td className="py-2">#{o.tokenNumber ?? o.id.slice(-6)}</td>
                    <td>{o.tableName ?? "—"}</td>
                    <td className="capitalize">{o.canonicalStatus}</td>
                    <td>{formatPrice(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <Modal open={!!selectedTable} onClose={() => setSelectedTable(null)} title={selectedTable ? tableLabel(selectedTable) : ""}>
        {selectedTable ? (
          <div className="space-y-4 p-6">
            <p className="text-sm text-slate-600">Status: {selectedTable.status}</p>
            <Link
              to={`/waiter/order/${selectedTable.id}`}
              className="block rounded-xl bg-brand-teal py-3 text-center font-bold text-white"
            >
              Open order screen
            </Link>
          </div>
        ) : null}
      </Modal>
    </DesktopAppShell>
  );
}
