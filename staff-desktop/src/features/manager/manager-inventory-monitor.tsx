import { useEffect, useMemo, useState } from "react";
import { collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { staffDb } from "@/lib/staff-db";
import { useAuth } from "@/contexts/AuthContext";
import { Toast } from "@/components/modals/Modal";

type Props = {
  loading: boolean;
  lastUpdated: Date | null;
};

type InventoryRow = {
  id: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
  updatedAt: unknown;
  pendingRequest: {
    status: "pending" | "approved" | "rejected";
    qty: number;
    note: string;
    requestedByUid: string;
    requestedByName: string;
    requestedAt: unknown;
    approvedByUid?: string;
    approvedByName?: string;
    approvedAt?: unknown;
  } | null;
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

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapInventoryRow(id: string, data: Record<string, unknown>): InventoryRow {
  const pending =
    data.pendingRequest && typeof data.pendingRequest === "object"
      ? (data.pendingRequest as Record<string, unknown>)
      : null;
  return {
    id,
    ingredientName:
      (typeof data.ingredientName === "string" && data.ingredientName.trim()) ||
      (typeof data.name === "string" && data.name.trim()) ||
      id,
    unit: typeof data.unit === "string" ? data.unit : "unit",
    currentStock: asNumber(data.currentStock, 0),
    minStock: Math.max(1, asNumber(data.minStock, 1)),
    isLowStock: data.isLowStock === true,
    updatedAt: data.updatedAt,
    pendingRequest: pending
      ? {
          status: ((pending.status as string) || "pending") as "pending" | "approved" | "rejected",
          qty: Math.max(0, asNumber(pending.qty, 0)),
          note: typeof pending.note === "string" ? pending.note : "",
          requestedByUid: typeof pending.requestedByUid === "string" ? pending.requestedByUid : "",
          requestedByName: typeof pending.requestedByName === "string" ? pending.requestedByName : "",
          requestedAt: pending.requestedAt,
          approvedByUid: typeof pending.approvedByUid === "string" ? pending.approvedByUid : undefined,
          approvedByName: typeof pending.approvedByName === "string" ? pending.approvedByName : undefined,
          approvedAt: pending.approvedAt
        }
      : null
  };
}

function stockClass(kind: "ok" | "low" | "critical" | "out"): string {
  if (kind === "out") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  if (kind === "critical") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  if (kind === "low") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
}

export function ManagerInventoryMonitor({ loading, lastUpdated }: Props) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestQty, setRequestQty] = useState("10");
  const [requestNote, setRequestNote] = useState("");

  useEffect(() => {
    const unsub = subscribeFirestoreQuery(
      "managerInventory.inventory",
      collection(staffDb, "inventory"),
      (snap) => {
        const next = snap.docs
          .map((d) => mapInventoryRow(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
        setRows(next);
      },
      (err) => {
        setErrors((prev) => (prev.includes(err.message) ? prev : [...prev, err.message]));
      }
    );
    return () => unsub();
  }, []);

  const selected = useMemo(
    () => (selectedId ? rows.find((row) => row.id === selectedId) ?? null : null),
    [rows, selectedId]
  );

  const lowStock = useMemo(
    () => rows.filter((row) => row.currentStock > 0 && (row.isLowStock || row.currentStock <= row.minStock)),
    [rows]
  );
  const outOfStock = useMemo(() => rows.filter((row) => row.currentStock <= 0), [rows]);
  const criticalStock = useMemo(
    () => rows.filter((row) => row.currentStock > 0 && row.currentStock <= Math.max(1, row.minStock * 0.5)),
    [rows]
  );
  const stockRequests = useMemo(
    () => rows.filter((row) => row.pendingRequest?.status === "pending"),
    [rows]
  );

  const usageRows = useMemo(() => {
    return rows
      .map((row) => {
        const par = Math.max(row.minStock * 2, row.currentStock + row.minStock);
        const consumed = Math.max(0, par - row.currentStock);
        const usagePct = Math.min(100, Math.round((consumed / par) * 100));
        return { ...row, usagePct };
      })
      .sort((a, b) => b.usagePct - a.usagePct)
      .slice(0, 10);
  }, [rows]);

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

  async function requestStock() {
    if (!selected) return;
    const qty = Math.max(1, Number(requestQty) || 1);
    await runAction(async () => {
      await updateDoc(doc(staffDb, "inventory", selected.id), {
        pendingRequest: {
          status: "pending",
          qty,
          note: requestNote.trim(),
          requestedByUid: profile?.uid ?? "",
          requestedByName: profile?.name ?? "Manager",
          requestedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    }, "Stock request submitted");
  }

  async function approveStockRequest() {
    if (!selected || !selected.pendingRequest || selected.pendingRequest.status !== "pending") return;
    await runAction(async () => {
      const qty = selected.pendingRequest?.qty ?? 0;
      await updateDoc(doc(staffDb, "inventory", selected.id), {
        currentStock: selected.currentStock + qty,
        isLowStock: selected.currentStock + qty <= selected.minStock,
        pendingRequest: {
          ...selected.pendingRequest,
          status: "approved",
          approvedByUid: profile?.uid ?? "",
          approvedByName: profile?.name ?? "Manager",
          approvedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    }, "Stock request approved");
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Inventory Monitor</h3>
            <p className="text-xs text-theme-text-secondary">
              Stock visibility, request approvals, and usage insights
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
        <div className="p-4 md:p-5">
          {loading ? (
            <p className="text-sm text-theme-text-secondary">Loading inventory monitor…</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className={`rounded-xl border p-3 ${stockClass("low")}`}>
                  <p className="text-xs">Low Stock</p>
                  <p className="mt-1 text-xl font-bold">{lowStock.length}</p>
                </article>
                <article className={`rounded-xl border p-3 ${stockClass("out")}`}>
                  <p className="text-xs">Out of Stock</p>
                  <p className="mt-1 text-xl font-bold">{outOfStock.length}</p>
                </article>
                <article className={`rounded-xl border p-3 ${stockClass("critical")}`}>
                  <p className="text-xs">Critical Stock</p>
                  <p className="mt-1 text-xl font-bold">{criticalStock.length}</p>
                </article>
                <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                  <p className="text-xs text-theme-text-secondary">Stock Requests</p>
                  <p className="mt-1 text-xl font-bold text-theme-text-primary">{stockRequests.length}</p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-theme-border bg-theme-card">
                  <div className="border-b border-theme-border px-3 py-2">
                    <p className="text-sm font-semibold">Inventory Items</p>
                  </div>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                    {rows.map((row) => {
                      const kind =
                        row.currentStock <= 0
                          ? "out"
                          : row.currentStock <= Math.max(1, row.minStock * 0.5)
                            ? "critical"
                            : row.isLowStock || row.currentStock <= row.minStock
                              ? "low"
                              : "ok";
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={[
                            "w-full rounded-lg border p-2 text-left text-sm transition",
                            stockClass(kind),
                            selectedId === row.id ? "ring-2 ring-theme-primary" : ""
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{row.ingredientName}</span>
                            <span>{row.currentStock} {row.unit}</span>
                          </div>
                          <p className="text-xs">Min: {row.minStock} {row.unit}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-theme-border bg-theme-card">
                  <div className="border-b border-theme-border px-3 py-2">
                    <p className="text-sm font-semibold">Inventory Usage</p>
                  </div>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                    {usageRows.map((row) => (
                      <article key={row.id} className="rounded-lg border border-theme-border bg-theme-surface p-2">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-semibold">{row.ingredientName}</span>
                          <span>{row.usagePct}% used</span>
                        </div>
                        <div className="h-2 rounded bg-theme-hover">
                          <div className="h-2 rounded bg-theme-primary" style={{ width: `${row.usagePct}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-theme-text-secondary">
                          Current: {row.currentStock} {row.unit} · Min: {row.minStock} {row.unit}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              {errors.length > 0 ? (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {errors.join(" · ")}
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="border-t border-theme-border p-4 xl:border-l xl:border-t-0">
          {!selected ? (
            <p className="text-sm text-theme-text-secondary">Select an item to request/approve stock.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs text-theme-text-secondary">Selected Item</p>
                <p className="text-lg font-bold">{selected.ingredientName}</p>
                <p className="text-xs text-theme-text-secondary">
                  Stock: {selected.currentStock} {selected.unit} · Min: {selected.minStock} {selected.unit}
                </p>
                <p className="text-xs text-theme-text-secondary">
                  Updated: {toDate(selected.updatedAt)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—"}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Request Stock</p>
                <input
                  type="number"
                  min={1}
                  value={requestQty}
                  onChange={(e) => setRequestQty(e.target.value)}
                  placeholder="Requested quantity"
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Request note"
                  className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestStock()}
                  className="w-full rounded-lg bg-theme-primary px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Request Stock
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Stock Requests</p>
                {selected.pendingRequest ? (
                  <>
                    <p className="text-xs text-theme-text-secondary">
                      Status: <span className="font-semibold capitalize">{selected.pendingRequest.status}</span>
                    </p>
                    <p className="text-xs text-theme-text-secondary">
                      Qty: {selected.pendingRequest.qty} {selected.unit}
                    </p>
                    <p className="text-xs text-theme-text-secondary">
                      Requested by: {selected.pendingRequest.requestedByName || "Unknown"}
                    </p>
                    <p className="text-xs text-theme-text-secondary">
                      Note: {selected.pendingRequest.note || "—"}
                    </p>
                    <button
                      type="button"
                      disabled={busy || selected.pendingRequest.status !== "pending"}
                      onClick={() => void approveStockRequest()}
                      className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      Approve Stock Request
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-theme-text-secondary">No pending request for this item.</p>
                )}
              </div>

              <div className="rounded-xl border border-theme-border bg-theme-card p-3 text-xs text-theme-text-secondary">
                Product creation is intentionally not available in Inventory Monitor.
              </div>
            </div>
          )}
        </aside>
      </div>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
