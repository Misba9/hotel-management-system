import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { StaffOrderRow } from "@/services/orders";
import { staffDb } from "@/lib/staff-db";
import { printChannelOrderBill } from "@/services/order-workflow";
import { Toast } from "@/components/modals/Modal";

type Props = {
  orders: StaffOrderRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type ToastState = { message: string; type: "info" | "success" | "error" } | null;

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") return new Date(value);
  return null;
}

function formatMoney(value: number): string {
  return `₹${Math.max(0, Number(value || 0)).toFixed(2)}`;
}

function formatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

function status(order: StaffOrderRow): string {
  return (order.canonicalStatus || order.status || "").toString().trim().toLowerCase();
}

function isBillRow(order: StaffOrderRow): boolean {
  const st = status(order);
  const pay = (order.paymentStatus ?? "").toLowerCase();
  if (st === "cancelled") return false;
  return ["ready", "served", "completed", "delivered", "new", "accepted", "preparing"].includes(st) || pay.length > 0;
}

export function ManagerBillingMonitor({ orders, loading, lastUpdated }: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [discountApprovalNote, setDiscountApprovalNote] = useState("");
  const [refundApprovalNote, setRefundApprovalNote] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const billRows = useMemo(() => orders.filter(isBillRow), [orders]);
  const selected = useMemo(
    () => (selectedOrderId ? billRows.find((row) => row.id === selectedOrderId) ?? null : null),
    [billRows, selectedOrderId]
  );

  const paymentHistory = useMemo(
    () =>
      billRows
        .filter((row) => (row.paymentStatus ?? "").toLowerCase() === "paid")
        .slice()
        .sort((a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0))
        .slice(0, 30),
    [billRows]
  );

  const paymentMethods = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const row of paymentHistory) {
      const method = ((row as Record<string, unknown>).paymentMethod ?? "unknown").toString().toLowerCase();
      const slot = map.get(method) ?? { count: 0, amount: 0 };
      slot.count += 1;
      slot.amount += Number(row.totalAmount ?? 0);
      map.set(method, slot);
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [paymentHistory]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      setToast({ message: successMessage, type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function approveDiscount() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "orders", selected.id), {
        managerDiscountApproved: true,
        managerDiscountApprovedAt: serverTimestamp(),
        managerDiscountApprovalNote: discountApprovalNote.trim() || null,
        updatedAt: serverTimestamp()
      });
    }, "Discount approved");
  }

  async function approveRefund() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "orders", selected.id), {
        managerRefundApproved: true,
        managerRefundApprovedAt: serverTimestamp(),
        managerRefundApprovalNote: refundApprovalNote.trim() || null,
        updatedAt: serverTimestamp()
      });
    }, "Refund approved");
  }

  async function voidBill() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "orders", selected.id), {
        billVoided: true,
        billVoidedAt: serverTimestamp(),
        billVoidReason: voidReason.trim() || "Voided by manager",
        updatedAt: serverTimestamp()
      });
    }, "Bill voided");
  }

  async function reprintInvoice() {
    if (!selected) return;
    await runAction(async () => {
      await printChannelOrderBill(selected, 5, "cash");
      await updateDoc(doc(staffDb, "orders", selected.id), {
        managerInvoiceReprintedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, "Invoice reprinted");
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Billing Monitor</h3>
            <p className="text-xs text-theme-text-secondary">
              Bills, approvals, invoice reprint, and payment analytics
            </p>
          </div>
          <p className="text-xs text-theme-text-secondary">
            Last update:{" "}
            <span className="font-semibold text-theme-text-primary">
              {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </span>
          </p>
        </div>
      </header>

      <div className="grid min-h-[560px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-auto border-b border-theme-border xl:border-b-0 xl:border-r">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-theme-card text-left text-xs uppercase tracking-wide text-theme-text-secondary">
              <tr>
                <th className="px-4 py-3">Bill</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-theme-text-secondary">Loading bills…</td>
                </tr>
              ) : billRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-theme-text-secondary">No bills found.</td>
                </tr>
              ) : (
                billRows.map((row) => {
                  const method = ((row as Record<string, unknown>).paymentMethod ?? "—").toString();
                  const payStatus = row.paymentStatus ?? "pending";
                  const isVoided = (row as Record<string, unknown>).billVoided === true;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedOrderId(row.id)}
                      className={[
                        "cursor-pointer border-t border-theme-border transition hover:bg-theme-hover",
                        selectedOrderId === row.id ? "bg-theme-primary/10" : "",
                        isVoided ? "opacity-70" : ""
                      ].join(" ")}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">#{row.tokenNumber ?? row.id.slice(-6)}</p>
                        <p className="text-xs text-theme-text-secondary">{row.customerName ?? "Walk-in"}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{status(row)}</td>
                      <td className="px-4 py-3 capitalize">{payStatus}</td>
                      <td className="px-4 py-3 capitalize">{method}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(row.totalAmount)}</td>
                      <td className="px-4 py-3 text-xs text-theme-text-secondary">{formatDateTime(row.updatedAt ?? row.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="space-y-3 p-4">
          {!selected ? (
            <p className="text-sm text-theme-text-secondary">Select a bill to review manager actions.</p>
          ) : (
            <>
              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs text-theme-text-secondary">Selected Bill</p>
                <p className="text-lg font-bold">#{selected.tokenNumber ?? selected.id.slice(-6)}</p>
                <p className="text-xs text-theme-text-secondary">
                  {selected.customerName ?? "Walk-in"} · {formatMoney(selected.totalAmount)}
                </p>
                <p className="text-xs text-theme-text-secondary">
                  Payment: {(selected.paymentStatus ?? "pending").toLowerCase()} · Method:{" "}
                  {((selected as Record<string, unknown>).paymentMethod ?? "—").toString()}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Manager Approvals</p>
                <textarea
                  value={discountApprovalNote}
                  onChange={(e) => setDiscountApprovalNote(e.target.value)}
                  rows={2}
                  placeholder="Discount approval note"
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void approveDiscount()}
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  Approve Discount
                </button>

                <textarea
                  value={refundApprovalNote}
                  onChange={(e) => setRefundApprovalNote(e.target.value)}
                  rows={2}
                  placeholder="Refund approval note"
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void approveRefund()}
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  Approve Refund
                </button>

                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={2}
                  placeholder="Void bill reason"
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void voidBill()}
                  className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-2 text-xs font-semibold text-rose-300 disabled:opacity-60"
                >
                  Void Bill
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reprintInvoice()}
                  className="w-full rounded-lg bg-theme-primary px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Reprint Invoice
                </button>
              </div>

              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Payment History</p>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                  {paymentHistory.length === 0 ? (
                    <p className="text-xs text-theme-text-secondary">No paid bills yet.</p>
                  ) : (
                    paymentHistory.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-md bg-theme-surface px-2 py-1.5 text-xs">
                        <span>#{row.tokenNumber ?? row.id.slice(-6)}</span>
                        <span className="capitalize text-theme-text-secondary">
                          {((row as Record<string, unknown>).paymentMethod ?? "unknown").toString()}
                        </span>
                        <span className="font-semibold">{formatMoney(row.totalAmount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Payment Methods</p>
                <div className="mt-2 space-y-1">
                  {paymentMethods.length === 0 ? (
                    <p className="text-xs text-theme-text-secondary">No payment method data yet.</p>
                  ) : (
                    paymentMethods.map(([method, summary]) => (
                      <div key={method} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-theme-text-secondary">{method}</span>
                        <span className="text-theme-text-secondary">{summary.count} bills</span>
                        <span className="font-semibold">{formatMoney(summary.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <p className="text-xs text-theme-text-secondary">
                Manager approval only. Payment processing remains restricted to cashier/POS flows.
              </p>
            </>
          )}
        </aside>
      </div>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
