import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { FloorTable } from "@/services/tables";
import type { StaffOrderRow } from "@/services/orders";
import type { StaffDirectoryRow } from "./types";
import { staffDb } from "@/lib/staff-db";
import { Toast } from "@/components/modals/Modal";

type Props = {
  staff: StaffDirectoryRow[];
  tables: FloorTable[];
  orders: StaffOrderRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type ToastState = { message: string; type: "info" | "success" | "error" } | null;

function minutesSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function hoursBetween(start: Date | null | undefined, end: Date | null | undefined): string {
  if (!start) return "—";
  const endAt = end ?? new Date();
  const ms = Math.max(0, endAt.getTime() - start.getTime());
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function tableLabel(table: FloorTable): string {
  return table.displayName || `Table ${table.number || table.id}`;
}

export function ManagerStaffManagement({ staff, tables, orders, loading, lastUpdated }: Props) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [assignTableId, setAssignTableId] = useState("");
  const [shiftValue, setShiftValue] = useState("morning");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const waiterRows = useMemo(
    () => staff.filter((row) => row.role === "waiter"),
    [staff]
  );
  const selected = useMemo(
    () => (selectedUid ? waiterRows.find((row) => row.uid === selectedUid) ?? null : null),
    [selectedUid, waiterRows]
  );

  const assignedTablesByWaiter = useMemo(() => {
    const map = new Map<string, FloorTable[]>();
    for (const table of tables) {
      const data = table as Record<string, unknown>;
      const waiterUid = typeof data.assignedWaiterUid === "string" ? data.assignedWaiterUid : "";
      if (!waiterUid) continue;
      const list = map.get(waiterUid) ?? [];
      list.push(table);
      map.set(waiterUid, list);
    }
    return map;
  }, [tables]);

  const workloadByWaiter = useMemo(() => {
    const map = new Map<string, { activeOrders: number; completedOrders: number }>();
    for (const order of orders) {
      const row = order as Record<string, unknown>;
      const waiterUid = typeof row.assignedWaiterUid === "string" ? row.assignedWaiterUid : "";
      if (!waiterUid) continue;
      const status = (order.canonicalStatus || order.status || "").toString().toLowerCase();
      const slot = map.get(waiterUid) ?? { activeOrders: 0, completedOrders: 0 };
      if (["new", "accepted", "preparing", "ready"].includes(status)) slot.activeOrders += 1;
      if (["completed", "delivered"].includes(status)) slot.completedOrders += 1;
      map.set(waiterUid, slot);
    }
    return map;
  }, [orders]);

  const onlineStaff = useMemo(
    () =>
      waiterRows.filter((row) => {
        const mins = minutesSince(row.lastSeenAt);
        return mins != null && mins <= 5;
      }),
    [waiterRows]
  );
  const offlineStaff = useMemo(
    () => waiterRows.filter((row) => !onlineStaff.some((online) => online.uid === row.uid)),
    [waiterRows, onlineStaff]
  );

  const availableTables = useMemo(
    () => tables.filter((table) => table.currentOrderId == null),
    [tables]
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

  async function assignWaiterToTable() {
    if (!selected || !assignTableId.trim()) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "tables", assignTableId.trim()), {
        assignedWaiterUid: selected.uid,
        assignedWaiterName: selected.name,
        updatedAt: serverTimestamp()
      });
    }, "Waiter assigned to table");
  }

  async function clockIn() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "staff_users", selected.uid), {
        clockInAt: serverTimestamp(),
        clockOutAt: null,
        shift: shiftValue,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, "Clock-in recorded");
  }

  async function clockOut() {
    if (!selected) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "staff_users", selected.uid), {
        clockOutAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, "Clock-out recorded");
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Staff Management</h3>
            <p className="text-xs text-theme-text-secondary">
              Waiter operations, workload, attendance, and performance
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
            <p className="text-sm text-theme-text-secondary">Loading staff presence…</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                  <p className="text-xs text-theme-text-secondary">Online Staff</p>
                  <p className="mt-1 text-xl font-bold">{onlineStaff.length}</p>
                </article>
                <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                  <p className="text-xs text-theme-text-secondary">Offline Staff</p>
                  <p className="mt-1 text-xl font-bold">{offlineStaff.length}</p>
                </article>
                <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                  <p className="text-xs text-theme-text-secondary">Clocked In</p>
                  <p className="mt-1 text-xl font-bold">
                    {waiterRows.filter((row) => row.clockInAt && !row.clockOutAt).length}
                  </p>
                </article>
                <article className="rounded-xl border border-theme-border bg-theme-card p-3">
                  <p className="text-xs text-theme-text-secondary">Total Waiters</p>
                  <p className="mt-1 text-xl font-bold">{waiterRows.length}</p>
                </article>
              </div>

              <div className="space-y-2">
                {waiterRows.map((row) => {
                  const assignedTables = assignedTablesByWaiter.get(row.uid) ?? [];
                  const load = workloadByWaiter.get(row.uid) ?? { activeOrders: 0, completedOrders: 0 };
                  const mins = minutesSince(row.lastSeenAt);
                  const online = mins != null && mins <= 5;
                  return (
                    <article
                      key={row.uid}
                      onClick={() => setSelectedUid(row.uid)}
                      className={[
                        "cursor-pointer rounded-xl border border-theme-border bg-theme-card p-3 transition hover:bg-theme-hover",
                        selectedUid === row.uid ? "ring-2 ring-theme-primary" : ""
                      ].join(" ")}
                    >
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-sm text-theme-text-secondary">{online ? "Online" : "Offline"}</p>
                        <p className="text-sm text-theme-text-secondary">Shift: {row.shift ?? "—"}</p>
                        <p className="text-sm text-theme-text-secondary">Tables: {assignedTables.length}</p>
                        <p className="text-sm text-theme-text-secondary">Active load: {load.activeOrders}</p>
                        <p className="text-sm text-theme-text-secondary">Completed: {load.completedOrders}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-theme-text-secondary">
                        <span>Clock In: {row.clockInAt ? row.clockInAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        <span>Clock Out: {row.clockOutAt ? row.clockOutAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        <span>Attendance: {hoursBetween(row.clockInAt, row.clockOutAt)}</span>
                        <span>Assigned: {assignedTables.map((table) => tableLabel(table)).join(", ") || "None"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="border-t border-theme-border p-4 xl:border-l xl:border-t-0">
          {!selected ? (
            <p className="text-sm text-theme-text-secondary">Select a waiter to manage shift/table assignment.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs text-theme-text-secondary">Selected Staff</p>
                <p className="text-lg font-bold">{selected.name}</p>
                <p className="text-xs text-theme-text-secondary">{selected.email || "No email"}</p>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Shift / Attendance</p>
                <select value={shiftValue} onChange={(e) => setShiftValue(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => void clockIn()} className="rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60">
                    Clock In
                  </button>
                  <button type="button" disabled={busy} onClick={() => void clockOut()} className="rounded-lg border border-theme-border bg-theme-surface px-2 py-2 text-xs font-semibold disabled:opacity-60">
                    Clock Out
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Assign Tables</p>
                <select value={assignTableId} onChange={(e) => setAssignTableId(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Select available table…</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {tableLabel(table)}
                    </option>
                  ))}
                </select>
                <button type="button" disabled={busy || !assignTableId} onClick={() => void assignWaiterToTable()} className="w-full rounded-lg bg-theme-primary px-2 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  Assign Waiter
                </button>
              </div>

              <div className="rounded-xl border border-theme-border bg-theme-card p-3 text-xs text-theme-text-secondary">
                <p className="font-semibold text-theme-text-primary">Performance Snapshot</p>
                <p className="mt-1">
                  Workload, attendance, and completion metrics are derived from live assigned orders and table responsibilities.
                </p>
                <p className="mt-1">No staff creation or deletion actions are exposed in this module.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
