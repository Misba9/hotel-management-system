import { useMemo, useState } from "react";
import { doc, runTransaction, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import type { FloorTable } from "@/services/tables";
import type { StaffOrderRow } from "@/services/orders";
import type { StaffDirectoryRow } from "./types";
import { staffDb } from "@/lib/staff-db";
import { Toast } from "@/components/modals/Modal";

type Props = {
  tables: FloorTable[];
  orders: StaffOrderRow[];
  staff: StaffDirectoryRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type UiTableStatus = "available" | "occupied" | "reserved" | "cleaning" | "billing";

type TableViewModel = FloorTable & {
  uiStatus: UiTableStatus;
  assignedWaiterUid?: string;
  assignedWaiterName?: string;
  managerStatus?: string;
  mergedIntoTableId?: string;
  mergedTableIds?: string[];
};

type ToastState = { message: string; type: "info" | "success" | "error" } | null;

function deriveUiStatus(table: FloorTable, order: StaffOrderRow | null): UiTableStatus {
  const data = table as Record<string, unknown>;
  const managerStatus = typeof data.managerStatus === "string" ? data.managerStatus.toLowerCase() : "";
  if (managerStatus === "reserved") return "reserved";
  if (managerStatus === "cleaning") return "cleaning";
  if (managerStatus === "billing") return "billing";
  if (order) {
    const payment = (order.paymentStatus ?? "").toLowerCase();
    if (payment === "requested" || payment === "pending") return "billing";
  }
  return table.status === "occupied" ? "occupied" : "available";
}

function statusClasses(status: UiTableStatus): string {
  if (status === "available") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "occupied") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  if (status === "reserved") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (status === "cleaning") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  return "border-violet-500/40 bg-violet-500/10 text-violet-300";
}

function statusLabel(status: UiTableStatus): string {
  if (status === "available") return "Available";
  if (status === "occupied") return "Occupied";
  if (status === "reserved") return "Reserved";
  if (status === "cleaning") return "Cleaning";
  return "Billing";
}

export function ManagerTableManagement({ tables, orders, staff, loading, lastUpdated }: Props) {
  const navigate = useNavigate();
  const [toast, setToast] = useState<ToastState>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [assignWaiterUid, setAssignWaiterUid] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [reservationName, setReservationName] = useState("");
  const [reservationPhone, setReservationPhone] = useState("");

  const orderById = useMemo(() => {
    const map = new Map<string, StaffOrderRow>();
    for (const order of orders) map.set(order.id, order);
    return map;
  }, [orders]);

  const waiterOptions = useMemo(
    () => staff.filter((row) => row.isActive && row.role === "waiter"),
    [staff]
  );

  const tableVm = useMemo<TableViewModel[]>(
    () =>
      tables.map((table) => {
        const data = table as Record<string, unknown>;
        const order = table.currentOrderId ? orderById.get(table.currentOrderId) ?? null : null;
        return {
          ...table,
          uiStatus: deriveUiStatus(table, order),
          managerStatus: typeof data.managerStatus === "string" ? data.managerStatus : undefined,
          assignedWaiterUid: typeof data.assignedWaiterUid === "string" ? data.assignedWaiterUid : undefined,
          assignedWaiterName: typeof data.assignedWaiterName === "string" ? data.assignedWaiterName : undefined,
          mergedIntoTableId: typeof data.mergedIntoTableId === "string" ? data.mergedIntoTableId : undefined,
          mergedTableIds: Array.isArray(data.mergedTableIds)
            ? data.mergedTableIds.filter((v): v is string => typeof v === "string")
            : undefined
        };
      }),
    [tables, orderById]
  );

  const selected = useMemo(
    () => (selectedTableId ? tableVm.find((table) => table.id === selectedTableId) ?? null : null),
    [selectedTableId, tableVm]
  );

  const selectedOrder = useMemo(
    () => (selected?.currentOrderId ? orderById.get(selected.currentOrderId) ?? null : null),
    [selected?.currentOrderId, orderById]
  );

  const availableTransferTargets = useMemo(
    () => tableVm.filter((table) => table.id !== selected?.id && table.currentOrderId == null),
    [tableVm, selected?.id]
  );

  const mergeTargets = useMemo(
    () =>
      tableVm.filter(
        (table) =>
          table.id !== selected?.id &&
          table.currentOrderId == null &&
          !table.mergedIntoTableId
      ),
    [tableVm, selected?.id]
  );

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

  async function setManagerStatus(table: TableViewModel, managerStatus: "reserved" | "cleaning" | "billing" | null) {
    await runAction(async () => {
      const ref = doc(staffDb, "tables", table.id);
      await updateDoc(ref, {
        managerStatus: managerStatus ?? null,
        updatedAt: serverTimestamp()
      });
    }, managerStatus ? `${statusLabel(managerStatus)} set` : "Manager status cleared");
  }

  async function handleAssignWaiter() {
    if (!selected || !assignWaiterUid.trim()) return;
    await runAction(async () => {
      const waiter = waiterOptions.find((w) => w.uid === assignWaiterUid.trim());
      if (!waiter) throw new Error("Select a waiter.");
      await updateDoc(doc(staffDb, "tables", selected.id), {
        assignedWaiterUid: waiter.uid,
        assignedWaiterName: waiter.name,
        updatedAt: serverTimestamp()
      });
    }, "Waiter assigned");
  }

  async function handleMergeTables() {
    if (!selected || !mergeTargetId.trim()) return;
    await runAction(async () => {
      const primaryRef = doc(staffDb, "tables", selected.id);
      const secondaryRef = doc(staffDb, "tables", mergeTargetId.trim());
      await runTransaction(staffDb, async (tx) => {
        const [primarySnap, secondarySnap] = await Promise.all([tx.get(primaryRef), tx.get(secondaryRef)]);
        if (!primarySnap.exists() || !secondarySnap.exists()) throw new Error("Table not found.");
        const primary = primarySnap.data() as Record<string, unknown>;
        const secondary = secondarySnap.data() as Record<string, unknown>;
        if (secondary.currentOrderId) throw new Error("Target table has a running order.");
        const mergedIds = Array.isArray(primary.mergedTableIds)
          ? primary.mergedTableIds.filter((v): v is string => typeof v === "string")
          : [];
        const nextMerged = [...new Set([...mergedIds, secondaryRef.id])];
        tx.update(primaryRef, {
          mergedTableIds: nextMerged,
          updatedAt: serverTimestamp()
        });
        tx.update(secondaryRef, {
          mergedIntoTableId: primaryRef.id,
          status: "occupied",
          managerStatus: "reserved",
          updatedAt: serverTimestamp()
        });
      });
    }, "Tables merged");
  }

  async function handleSplitTables() {
    if (!selected) return;
    await runAction(async () => {
      const ids = selected.mergedTableIds ?? [];
      if (ids.length === 0) throw new Error("No merged tables to split.");
      const batch = writeBatch(staffDb);
      batch.update(doc(staffDb, "tables", selected.id), {
        mergedTableIds: [],
        updatedAt: serverTimestamp()
      });
      for (const id of ids) {
        batch.update(doc(staffDb, "tables", id), {
          mergedIntoTableId: null,
          status: "available",
          managerStatus: null,
          currentOrderId: null,
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    }, "Tables split");
  }

  async function handleTransferTable() {
    if (!selected || !selected.currentOrderId || !transferTargetId.trim()) return;
    await runAction(async () => {
      const runningOrderId = selected.currentOrderId;
      if (!runningOrderId) throw new Error("No running order on selected table.");
      const orderRef = doc(staffDb, "orders", runningOrderId);
      const sourceTableRef = doc(staffDb, "tables", selected.id);
      const targetTableRef = doc(staffDb, "tables", transferTargetId.trim());
      await runTransaction(staffDb, async (tx) => {
        const [orderSnap, targetSnap] = await Promise.all([tx.get(orderRef), tx.get(targetTableRef)]);
        if (!orderSnap.exists()) throw new Error("Running order not found.");
        if (!targetSnap.exists()) throw new Error("Target table not found.");
        const target = targetSnap.data() as Record<string, unknown>;
        if (target.currentOrderId) throw new Error("Target table is not free.");
        const targetName =
          (typeof target.name === "string" && target.name.trim()) ||
          (typeof target.tableNumber === "number" ? `Table ${target.tableNumber}` : `Table ${targetTableRef.id}`);
        tx.update(orderRef, {
          tableId: targetTableRef.id,
          tableName: targetName,
          tableNumber: typeof target.tableNumber === "number" ? target.tableNumber : null,
          updatedAt: serverTimestamp()
        });
        tx.update(sourceTableRef, {
          currentOrderId: null,
          status: "available",
          managerStatus: null,
          updatedAt: serverTimestamp()
        });
        tx.update(targetTableRef, {
          currentOrderId: orderRef.id,
          status: "occupied",
          updatedAt: serverTimestamp()
        });
      });
    }, "Table transferred");
  }

  async function handleReserveTable() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "tables", selected.id), {
        managerStatus: "reserved",
        reservationName: reservationName.trim() || null,
        reservationPhone: reservationPhone.trim() || null,
        reservedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, "Table reserved");
  }

  function openRunningOrder() {
    if (!selected?.currentOrderId) return;
    window.localStorage.setItem("manager.orders.focusOrderId", selected.currentOrderId);
    navigate("/manager/orders");
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Interactive Table Management</h3>
            <p className="text-xs text-theme-text-secondary">
              Realtime floor sync with waiter/cashier table updates
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
            <p className="text-sm text-theme-text-secondary">Loading restaurant floor…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {(["available", "occupied", "reserved", "cleaning", "billing"] as UiTableStatus[]).map((status) => (
                  <span key={status} className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}>
                    {statusLabel(status)} ({tableVm.filter((table) => table.uiStatus === status).length})
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {tableVm.map((table) => {
                  const active = selected?.id === table.id;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTableId(table.id)}
                      className={[
                        "rounded-2xl border p-3 text-left transition",
                        statusClasses(table.uiStatus),
                        active ? "ring-2 ring-theme-primary" : "hover:brightness-110"
                      ].join(" ")}
                    >
                      <p className="text-sm font-bold">{table.displayName || `Table ${table.number || table.id}`}</p>
                      <p className="mt-1 text-xs">{statusLabel(table.uiStatus)}</p>
                      <p className="mt-2 text-xs">Order: {table.currentOrderId ? `#${table.currentOrderId.slice(-6)}` : "None"}</p>
                      <p className="text-xs">Waiter: {table.assignedWaiterName ?? "Unassigned"}</p>
                      {table.mergedIntoTableId ? (
                        <p className="mt-1 text-[11px] font-semibold">Merged into: {table.mergedIntoTableId.slice(-4)}</p>
                      ) : null}
                      {table.mergedTableIds?.length ? (
                        <p className="mt-1 text-[11px] font-semibold">Merged tables: {table.mergedTableIds.length}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="border-t border-theme-border p-4 xl:border-l xl:border-t-0">
          {!selected ? (
            <p className="text-sm text-theme-text-secondary">Select a table to manage actions.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs text-theme-text-secondary">Selected</p>
                <p className="text-lg font-bold">{selected.displayName || `Table ${selected.number || selected.id}`}</p>
                <p className="text-xs text-theme-text-secondary">
                  {statusLabel(selected.uiStatus)} · Order {selected.currentOrderId ? `#${selected.currentOrderId.slice(-6)}` : "None"}
                </p>
                <p className="text-xs text-theme-text-secondary">Waiter: {selected.assignedWaiterName ?? "Unassigned"}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => void setManagerStatus(selected, "reserved")} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Reserve</button>
                <button type="button" disabled={busy} onClick={() => void setManagerStatus(selected, "cleaning")} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Cleaning</button>
                <button type="button" disabled={busy} onClick={() => void setManagerStatus(selected, "billing")} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Billing</button>
                <button type="button" disabled={busy} onClick={() => void setManagerStatus(selected, null)} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Clear Status</button>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Assign Waiter</p>
                <select value={assignWaiterUid} onChange={(e) => setAssignWaiterUid(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Select waiter…</option>
                  {waiterOptions.map((waiter) => (
                    <option key={waiter.uid} value={waiter.uid}>{waiter.name}</option>
                  ))}
                </select>
                <button type="button" disabled={busy || !assignWaiterUid} onClick={() => void handleAssignWaiter()} className="w-full rounded-lg bg-theme-primary px-2 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  Assign Waiter
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Merge / Split Tables</p>
                <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Merge with table…</option>
                  {mergeTargets.map((table) => (
                    <option key={table.id} value={table.id}>{table.displayName || `Table ${table.number || table.id}`}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy || !mergeTargetId} onClick={() => void handleMergeTables()} className="rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60">Merge Tables</button>
                  <button type="button" disabled={busy || !(selected.mergedTableIds?.length)} onClick={() => void handleSplitTables()} className="rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60">Split Tables</button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Transfer Table</p>
                <select value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Transfer to table…</option>
                  {availableTransferTargets.map((table) => (
                    <option key={table.id} value={table.id}>{table.displayName || `Table ${table.number || table.id}`}</option>
                  ))}
                </select>
                <button type="button" disabled={busy || !selected.currentOrderId || !transferTargetId} onClick={() => void handleTransferTable()} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60">
                  Transfer Running Order
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Reserve Table</p>
                <input value={reservationName} onChange={(e) => setReservationName(e.target.value)} placeholder="Guest name" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                <input value={reservationPhone} onChange={(e) => setReservationPhone(e.target.value)} placeholder="Guest phone" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                <button type="button" disabled={busy} onClick={() => void handleReserveTable()} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold">
                  Save Reservation
                </button>
              </div>

              <button type="button" disabled={!selected.currentOrderId} onClick={openRunningOrder} className="w-full rounded-xl bg-theme-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                Open Running Order
              </button>

              {selectedOrder ? (
                <p className="text-xs text-theme-text-secondary">
                  Live order: #{selectedOrder.tokenNumber ?? selectedOrder.id.slice(-6)} · {selectedOrder.items.length} items · ₹
                  {selectedOrder.totalAmount.toFixed(2)}
                </p>
              ) : null}
            </div>
          )}
        </aside>
      </div>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
