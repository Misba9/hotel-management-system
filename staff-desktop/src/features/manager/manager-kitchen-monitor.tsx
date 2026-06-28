import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { StaffOrderRow } from "@/services/orders";
import { staffDb } from "@/lib/staff-db";
import { Toast } from "@/components/modals/Modal";

type Props = {
  orders: StaffOrderRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type ToastState = { message: string; type: "info" | "success" | "error" } | null;

type KitchenBucket = "new" | "preparing" | "ready" | "delayed" | "completed";

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function orderStatus(order: StaffOrderRow): string {
  return (order.canonicalStatus || order.status || "").toString().trim().toLowerCase();
}

function elapsedMinutes(order: StaffOrderRow): number {
  const data = order as Record<string, unknown>;
  const anchor =
    toDate(data.preparingAt) ??
    toDate(data.acceptedAt) ??
    toDate(order.createdAt);
  if (!anchor) return 0;
  return Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 60000));
}

function isDelayed(order: StaffOrderRow): boolean {
  const status = orderStatus(order);
  if (!["new", "accepted", "preparing", "ready"].includes(status)) return false;
  return elapsedMinutes(order) >= 20;
}

function bucketForOrder(order: StaffOrderRow): KitchenBucket[] {
  const status = orderStatus(order);
  const buckets: KitchenBucket[] = [];
  if (status === "new" || status === "accepted") buckets.push("new");
  if (status === "preparing") buckets.push("preparing");
  if (status === "ready") buckets.push("ready");
  if (status === "completed" || status === "delivered") buckets.push("completed");
  if (isDelayed(order)) buckets.push("delayed");
  return buckets;
}

function bucketTitle(bucket: KitchenBucket): string {
  if (bucket === "new") return "New Orders";
  if (bucket === "preparing") return "Preparing";
  if (bucket === "ready") return "Ready";
  if (bucket === "delayed") return "Delayed";
  return "Completed";
}

function statusTone(status: string): string {
  if (status === "new" || status === "accepted") return "bg-amber-500/20 text-amber-300";
  if (status === "preparing") return "bg-indigo-500/20 text-indigo-300";
  if (status === "ready") return "bg-emerald-500/20 text-emerald-300";
  if (status === "completed" || status === "delivered") return "bg-green-600/20 text-green-300";
  return "bg-theme-hover text-theme-text-secondary";
}

export function ManagerKitchenMonitor({ orders, loading, lastUpdated }: Props) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const grouped = useMemo(() => {
    const map: Record<KitchenBucket, StaffOrderRow[]> = {
      new: [],
      preparing: [],
      ready: [],
      delayed: [],
      completed: []
    };
    for (const order of orders) {
      for (const bucket of bucketForOrder(order)) {
        map[bucket].push(order);
      }
    }
    for (const key of Object.keys(map) as KitchenBucket[]) {
      map[key].sort((a, b) => {
        const aTime = toDate(a.createdAt)?.getTime() ?? 0;
        const bTime = toDate(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      });
    }
    return map;
  }, [orders]);

  async function run(orderId: string, task: () => Promise<void>, ok: string) {
    setBusyOrderId(orderId);
    try {
      await task();
      setToast({ message: ok, type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setToast({ message, type: "error" });
    } finally {
      setBusyOrderId(null);
    }
  }

  function prioritize(order: StaffOrderRow) {
    void run(
      order.id,
      async () => {
        const flagged = (order as Record<string, unknown>).priority === true;
        await updateDoc(doc(staffDb, "orders", order.id), {
          priority: !flagged,
          priorityAt: !flagged ? serverTimestamp() : null,
          updatedAt: serverTimestamp()
        });
      },
      "Priority updated"
    );
  }

  function notifyKitchen(order: StaffOrderRow) {
    void run(
      order.id,
      async () => {
        await updateDoc(doc(staffDb, "orders", order.id), {
          managerKitchenNotifiedAt: serverTimestamp(),
          managerKitchenNotified: true,
          updatedAt: serverTimestamp()
        });
      },
      "Kitchen notified"
    );
  }

  const delayedCount = grouped.delayed.length;

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Kitchen Monitor</h3>
            <p className="text-xs text-theme-text-secondary">
              Realtime sync with kitchen workflows · delayed:{" "}
              <span className={delayedCount > 0 ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"}>
                {delayedCount}
              </span>
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

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 2xl:grid-cols-5">
        {(["new", "preparing", "ready", "delayed", "completed"] as KitchenBucket[]).map((bucket) => (
          <div key={bucket} className="rounded-xl border border-theme-border bg-theme-card">
            <div className="flex items-center justify-between border-b border-theme-border px-3 py-2">
              <h4 className="text-sm font-semibold text-theme-text-primary">{bucketTitle(bucket)}</h4>
              <span className="rounded-full bg-theme-hover px-2 py-0.5 text-xs font-semibold text-theme-text-secondary">
                {grouped[bucket].length}
              </span>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
              {loading ? (
                <p className="text-xs text-theme-text-secondary">Loading…</p>
              ) : grouped[bucket].length === 0 ? (
                <p className="text-xs text-theme-text-secondary">No orders</p>
              ) : (
                grouped[bucket].map((order) => {
                  const status = orderStatus(order);
                  const prepMins = elapsedMinutes(order);
                  const flagged = (order as Record<string, unknown>).priority === true;
                  const notifiedAt = toDate((order as Record<string, unknown>).managerKitchenNotifiedAt);
                  return (
                    <article
                      key={`${bucket}-${order.id}`}
                      className="rounded-xl border border-theme-border bg-theme-surface p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          #{order.tokenNumber ?? order.id.slice(-6)}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(status)}`}>
                          {status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-theme-text-secondary">
                        {order.items.length} items · {order.tableName ?? order.orderType ?? "general"}
                      </p>
                      <p className="mt-1 text-xs text-theme-text-secondary">
                        Prep time: <span className={prepMins >= 20 ? "font-semibold text-rose-300" : "font-semibold text-theme-text-primary"}>{prepMins}m</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => prioritize(order)}
                          disabled={busyOrderId === order.id}
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold ${flagged ? "bg-rose-500/20 text-rose-300" : "bg-theme-hover text-theme-text-secondary hover:text-theme-text-primary"} disabled:opacity-60`}
                        >
                          {flagged ? "Priority On" : "Prioritize"}
                        </button>
                        <button
                          type="button"
                          onClick={() => notifyKitchen(order)}
                          disabled={busyOrderId === order.id}
                          className="rounded-md bg-theme-primary px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                        >
                          Notify Kitchen
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-theme-text-disabled">
                        {notifiedAt ? `Notified ${notifiedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not notified"}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
