import { useMemo, useState } from "react";
import type { StaffOrderRow } from "@/services/orders";
import { markCashierOrderPaid } from "@/services/orders";
import {
  acceptChannelOrder,
  completeChannelOrder,
  markChannelOrderPreparing,
  markChannelOrderReady,
  printChannelOrderBill,
  rejectChannelOrder
} from "@/services/order-workflow";
import type { PlatformTab } from "@/lib/pos/cashier-pos-store";
import { getOrderSourceMeta, ORDER_SOURCE_META } from "@/lib/pos/order-source";
import {
  countWorkflowStatuses,
  filterOrdersByWorkflow,
  formatOrderTime,
  orderBelongsToPlatform,
  orderCustomerName,
  orderCustomerPhone,
  orderDisplayId,
  resolveWorkflowStatus,
  WORKFLOW_STATUSES,
  WORKFLOW_STATUS_META,
  type WorkflowStatus
} from "@/lib/pos/order-workflow-status";
import { allowedActionsForStatus } from "@/lib/pos/order-permissions";
import { OrderTimeline } from "@/components/pos/OrderTimeline";
import { Modal } from "@/components/modals/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { usePosSettings } from "@/hooks/use-pos-settings";
import type { PaymentMethodId } from "@/services/restaurant-orders";

function formatPrice(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

type OrderChannelManagerProps = {
  platform: PlatformTab;
  orders: StaffOrderRow[];
  loading?: boolean;
  onToast: (msg: string, type?: "info" | "success" | "error") => void;
};

export function OrderChannelManager({ platform, orders, loading, onToast }: OrderChannelManagerProps) {
  const { profile, role } = useAuth();
  const { taxPercent } = usePosSettings();
  const [statusTab, setStatusTab] = useState<WorkflowStatus>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const platformOrders = useMemo(
    () => orders.filter((o) => orderBelongsToPlatform(o, platform)),
    [orders, platform]
  );

  const workflowCounts = useMemo(() => countWorkflowStatuses(platformOrders), [platformOrders]);

  const filtered = useMemo(
    () => filterOrdersByWorkflow(platformOrders, statusTab),
    [platformOrders, statusTab]
  );

  const selected = useMemo(
    () => (selectedId ? platformOrders.find((o) => o.id === selectedId) ?? null : null),
    [platformOrders, selectedId]
  );

  const workflow = selected ? resolveWorkflowStatus(selected) : null;
  const actions = workflow && role ? allowedActionsForStatus(role, workflow, selected ?? undefined) : [];

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      onToast(successMsg, "success");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = () => {
    if (!selected) return;
    void runAction(async () => {
      await acceptChannelOrder(selected.id, profile?.uid);
      setStatusTab("accepted");
    }, `Order ${orderDisplayId(selected)} accepted — KOT sent to kitchen`);
  };

  const handleReject = () => {
    if (!selected) return;
    setRejectOpen(true);
  };

  const confirmReject = () => {
    if (!selected) return;
    void runAction(async () => {
      await rejectChannelOrder(selected.id, rejectReason, profile?.uid);
      setRejectOpen(false);
      setRejectReason("");
      setSelectedId(null);
      setStatusTab("cancelled");
    }, "Order rejected");
  };

  const handlePreparing = () => {
    if (!selected) return;
    void runAction(async () => {
      await markChannelOrderPreparing(selected.id);
      setStatusTab("preparing");
    }, "Kitchen marked preparing");
  };

  const handleReady = () => {
    if (!selected) return;
    void runAction(async () => {
      await markChannelOrderReady(selected.id);
      setStatusTab("ready");
    }, "Order marked ready");
  };

  const handleComplete = () => {
    if (!selected) return;
    void runAction(async () => {
      await completeChannelOrder(selected.id);
      setStatusTab("completed");
      setSelectedId(null);
    }, "Order completed");
  };

  const handlePayAndComplete = () => {
    if (!selected) return;
    void runAction(async () => {
      await markCashierOrderPaid(selected.id, "cash");
      setStatusTab("completed");
      setSelectedId(null);
    }, "Payment recorded — order completed");
  };

  const handlePrintBill = () => {
    if (!selected) return;
    void runAction(async () => {
      await printChannelOrderBill(selected, taxPercent, "cash" as PaymentMethodId);
    }, "Bill sent to printer");
  };

  const platformMeta =
    platform === "swiggy"
      ? ORDER_SOURCE_META.swiggy
      : platform === "zomato"
        ? ORDER_SOURCE_META.zomato
        : platform === "waiter"
          ? ORDER_SOURCE_META.waiter
          : ORDER_SOURCE_META.online;

  const activeCount =
    workflowCounts.new + workflowCounts.accepted + workflowCounts.preparing + workflowCounts.ready;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      {/* Platform header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <span>{platformMeta.emoji}</span>
            <span>{platformMeta.label} Orders</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {activeCount} active
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Accept · reject · print bill · complete</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {WORKFLOW_STATUSES.map((s) => {
          const meta = WORKFLOW_STATUS_META[s];
          const count = workflowCounts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusTab(s)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${
                statusTab === s ? "text-white shadow-sm" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
              style={statusTab === s ? { backgroundColor: meta.color } : undefined}
            >
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Order list — multi-column grid on wide screens */}
        <div className="min-h-0 overflow-y-auto border-b border-slate-200 p-4 dark:border-slate-800 xl:border-b-0 xl:border-r">
          {loading ? <p className="p-4 text-sm text-slate-400">Loading orders…</p> : null}
          {!loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl">{platformMeta.emoji}</p>
              <p className="mt-3 text-lg font-bold text-slate-600 dark:text-slate-300">
                No {WORKFLOW_STATUS_META[statusTab].label.toLowerCase()} orders
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {statusTab === "new"
                  ? `New ${platformMeta.label} orders will appear here automatically`
                  : `Switch to another tab to see orders`}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((order) => {
            const ws = resolveWorkflowStatus(order);
            const meta = WORKFLOW_STATUS_META[ws];
            const src = getOrderSourceMeta(order);
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedId === order.id
                    ? "border-brand-teal bg-brand-teal/5 shadow-md ring-2 ring-brand-teal/30"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{orderDisplayId(order)}</p>
                    <p className="text-xs text-slate-500">{orderCustomerName(order)}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{src.emoji} {src.label}</span>
                  <span className="font-bold text-brand-teal">{formatPrice(order.totalAmount)}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Order detail — fixed right panel */}
        <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 xl:border-t-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl opacity-40">{platformMeta.emoji}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">Select an order to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-extrabold">{orderDisplayId(selected)}</p>
                <p className="text-xs text-slate-500">{formatOrderTime(selected)}</p>
              </div>

              <OrderTimeline
                current={workflow!}
                cancelled={workflow === "cancelled"}
              />

              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-semibold">{orderCustomerName(selected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Phone</dt>
                  <dd>{orderCustomerPhone(selected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Source</dt>
                  <dd>{getOrderSourceMeta(selected).label}</dd>
                </div>
                {selected.tableName || selected.tableNumber ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Table</dt>
                    <dd>{selected.tableName ?? `Table ${selected.tableNumber}`}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-brand-teal">
                  <dt>Total</dt>
                  <dd>{formatPrice(selected.totalAmount)}</dd>
                </div>
              </dl>

              <ul className="divide-y rounded-xl border text-sm dark:border-slate-700">
                {selected.items.map((it, i) => (
                  <li key={i} className="flex justify-between px-3 py-2">
                    <span>
                      {it.qty}× {it.name}
                    </span>
                    <span>{formatPrice(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>

              {(selected as StaffOrderRow & { notes?: string }).notes ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                  <strong>Notes:</strong> {(selected as StaffOrderRow & { notes?: string }).notes}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {actions.includes("accept") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleAccept}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                ) : null}
                {actions.includes("reject") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReject}
                    className="flex-1 rounded-xl border-2 border-red-300 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : null}
                {actions.includes("preparing") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePreparing}
                    className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Mark Preparing
                  </button>
                ) : null}
                {actions.includes("ready") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReady}
                    className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Mark Ready
                  </button>
                ) : null}
                {actions.includes("print_bill") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePrintBill}
                    className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Print Bill
                  </button>
                ) : null}
                {actions.includes("complete") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleComplete}
                    className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Complete
                  </button>
                ) : null}
                {actions.includes("pay") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePayAndComplete}
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Pay & Complete
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject order" widthClass="max-w-md">
        <div className="space-y-4 p-5">
          <label className="block text-sm font-semibold">
            Reason
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="Out of stock, closed, etc."
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={confirmReject}
            className="w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50"
          >
            Confirm reject
          </button>
        </div>
      </Modal>
    </div>
  );
}
