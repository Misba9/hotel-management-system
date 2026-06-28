import { useMemo, useState } from "react";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import type { FloorTable } from "@/services/tables";
import type { StaffOrderRow } from "@/services/orders";
import { staffDb } from "@/lib/staff-db";
import { printKitchenKot } from "@/services/kitchen-kot-print";
import { printChannelOrderBill } from "@/services/order-workflow";
import { Modal, Toast } from "@/components/modals/Modal";
import type { StaffDirectoryRow } from "./types";

type Props = {
  orders: StaffOrderRow[];
  tables: FloorTable[];
  staff: StaffDirectoryRow[];
  loading: boolean;
  lastUpdated: Date | null;
};

type FilterKey =
  | "all"
  | "dine_in"
  | "parcel"
  | "online"
  | "swiggy"
  | "zomato"
  | "completed"
  | "cancelled"
  | "pending"
  | "preparing"
  | "ready";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "dine_in", label: "Dine In" },
  { key: "parcel", label: "Parcel" },
  { key: "online", label: "Online" },
  { key: "swiggy", label: "Swiggy" },
  { key: "zomato", label: "Zomato" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" }
];

type ToastState = { message: string; type: "info" | "success" | "error" } | null;

function safeStatus(order: StaffOrderRow): string {
  return (order.canonicalStatus || order.status || "").toString().trim().toLowerCase();
}

function isOrderInFilter(order: StaffOrderRow, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const status = safeStatus(order);
  const source = (order.source ?? "").toString().toLowerCase();
  const type = (order.orderType ?? "").toString().toLowerCase();
  if (filter === "dine_in") return type === "dine_in" || type === "table";
  if (filter === "parcel") return type === "parcel" || source === "parcel";
  if (filter === "online") return type === "online" || ["online", "website", "swiggy", "zomato"].includes(source);
  if (filter === "swiggy") return source === "swiggy";
  if (filter === "zomato") return source === "zomato";
  if (filter === "completed") return status === "completed" || status === "delivered";
  if (filter === "cancelled") return status === "cancelled";
  if (filter === "pending") return status === "new" || status === "accepted" || status === "pending";
  if (filter === "preparing") return status === "preparing";
  if (filter === "ready") return status === "ready";
  return true;
}

function formatMoney(value: number): string {
  return `₹${Math.max(0, Number(value || 0)).toFixed(2)}`;
}

function formatDateTime(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return (value.toDate() as Date).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    } catch {
      return "—";
    }
  }
  if (value instanceof Date) {
    return value.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  }
  return "—";
}

function mergeItems(primary: StaffOrderRow["items"], secondary: StaffOrderRow["items"]) {
  const map = new Map<string, { id: string; name: string; price: number; qty: number; note?: string; modifications?: string[] }>();
  for (const item of [...primary, ...secondary]) {
    const key = `${item.id || item.name}-${item.price}`;
    const prev = map.get(key);
    if (prev) {
      prev.qty += item.qty;
      map.set(key, prev);
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()];
}

export function ManagerOrderManagement({ orders, tables, staff, loading, lastUpdated }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [busy, setBusy] = useState(false);

  const [cancelReason, setCancelReason] = useState("");
  const [mergeWithOrderId, setMergeWithOrderId] = useState("");
  const [splitParts, setSplitParts] = useState(2);
  const [transferTableId, setTransferTableId] = useState("");
  const [assignWaiterUid, setAssignWaiterUid] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId]
  );

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((order) => isOrderInFilter(order, filter))
      .filter((order) => {
        if (!q) return true;
        const search = [
          order.id,
          String(order.tokenNumber ?? ""),
          order.customerName ?? "",
          order.customerPhone ?? "",
          order.tableName ?? "",
          order.source ?? "",
          order.orderType ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return search.includes(q);
      });
  }, [orders, filter, query]);

  const mergeCandidates = useMemo(() => {
    if (!selectedOrder) return [];
    return filteredOrders.filter((order) => order.id !== selectedOrder.id && safeStatus(order) !== "cancelled");
  }, [filteredOrders, selectedOrder]);

  const availableTables = useMemo(
    () => tables.filter((table) => table.status.toLowerCase() === "available" || table.id === selectedOrder?.tableId),
    [tables, selectedOrder?.tableId]
  );
  const waiterOptions = useMemo(
    () => staff.filter((row) => row.isActive && row.role === "waiter"),
    [staff]
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

  async function handleEdit() {
    if (!selectedOrder) return;
    await runAction(async () => {
      const customerName = editCustomerName.trim();
      const customerPhone = editCustomerPhone.trim();
      const notes = editNotes.trim();
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        ...(customerName ? { customerName } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        notes,
        "customer.name": customerName || selectedOrder.customerName || "",
        "customer.phone": customerPhone || selectedOrder.customerPhone || "",
        updatedAt: serverTimestamp()
      });
    }, "Order updated");
  }

  async function handleCancel() {
    if (!selectedOrder) return;
    await runAction(async () => {
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        status: "cancelled",
        cancelReason: cancelReason.trim() || "Cancelled by manager",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, "Order cancelled");
  }

  async function handleMerge() {
    if (!selectedOrder || !mergeWithOrderId.trim()) return;
    await runAction(async () => {
      const primaryRef = doc(staffDb, "orders", selectedOrder.id);
      const secondaryRef = doc(staffDb, "orders", mergeWithOrderId.trim());
      await runTransaction(staffDb, async (tx) => {
        const [primarySnap, secondarySnap] = await Promise.all([tx.get(primaryRef), tx.get(secondaryRef)]);
        if (!primarySnap.exists() || !secondarySnap.exists()) throw new Error("Order not found for merge.");
        const primary = primarySnap.data() as Record<string, unknown>;
        const secondary = secondarySnap.data() as Record<string, unknown>;
        const primaryItems = Array.isArray(primary.items) ? (primary.items as StaffOrderRow["items"]) : [];
        const secondaryItems = Array.isArray(secondary.items) ? (secondary.items as StaffOrderRow["items"]) : [];
        const mergedItems = mergeItems(primaryItems, secondaryItems);
        const mergedTotal = mergedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        tx.update(primaryRef, {
          items: mergedItems,
          totalAmount: mergedTotal,
          total: mergedTotal,
          mergedFromOrderId: secondaryRef.id,
          updatedAt: serverTimestamp()
        });
        tx.update(secondaryRef, {
          status: "cancelled",
          cancelReason: `Merged into ${primaryRef.id}`,
          mergedIntoOrderId: primaryRef.id,
          updatedAt: serverTimestamp()
        });
      });
    }, "Orders merged");
  }

  async function handleSplitBill() {
    if (!selectedOrder) return;
    await runAction(async () => {
      const base = Number((selectedOrder as Record<string, unknown>).subtotal ?? selectedOrder.totalAmount ?? 0);
      const parts = Math.max(2, Math.min(6, Number(splitParts) || 2));
      const each = Math.round(((base / parts) * 100)) / 100;
      const amounts = Array.from({ length: parts }, (_, index) => (index === parts - 1 ? Math.round((base - each * (parts - 1)) * 100) / 100 : each));
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        splitBill: {
          parts,
          amounts,
          updatedAt: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      });
    }, "Split bill applied");
  }

  async function handleTransferTable() {
    if (!selectedOrder || !transferTableId.trim()) return;
    await runAction(async () => {
      const nextTable = tables.find((table) => table.id === transferTableId.trim());
      if (!nextTable) throw new Error("Select a valid table.");
      const batch = writeBatch(staffDb);
      const orderRef = doc(staffDb, "orders", selectedOrder.id);
      const nextRef = doc(staffDb, "tables", nextTable.id);
      batch.update(orderRef, {
        tableId: nextTable.id,
        tableNumber: nextTable.number ?? null,
        tableName: nextTable.displayName ?? `Table ${nextTable.number ?? nextTable.id}`,
        updatedAt: serverTimestamp()
      });
      if (selectedOrder.tableId && selectedOrder.tableId !== nextTable.id) {
        batch.update(doc(staffDb, "tables", selectedOrder.tableId), {
          currentOrderId: null,
          status: "available"
        });
      }
      batch.update(nextRef, { currentOrderId: selectedOrder.id, status: "occupied" });
      await batch.commit();
    }, "Table transferred");
  }

  async function handleAssignWaiter() {
    if (!selectedOrder || !assignWaiterUid.trim()) return;
    await runAction(async () => {
      const waiter = waiterOptions.find((row) => row.uid === assignWaiterUid.trim());
      if (!waiter) throw new Error("Select a valid waiter.");
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        assignedWaiterUid: waiter.uid,
        assignedWaiterName: waiter.name,
        "assignedTo.waiterId": waiter.uid,
        updatedAt: serverTimestamp()
      });
    }, "Waiter assigned");
  }

  async function handleReprintBill() {
    if (!selectedOrder) return;
    await runAction(async () => {
      await printChannelOrderBill(selectedOrder, 5, "cash");
    }, "Bill reprinted");
  }

  async function handleReprintKot() {
    if (!selectedOrder) return;
    await runAction(async () => {
      await printKitchenKot(selectedOrder, { source: "manual" });
    }, "KOT reprinted");
  }

  async function handleApplyDiscount() {
    if (!selectedOrder) return;
    await runAction(async () => {
      const discount = Math.max(0, Number(discountAmount) || 0);
      const currentDiscount = Number((selectedOrder as Record<string, unknown>).discountAmount ?? 0);
      const base = Number((selectedOrder as Record<string, unknown>).subtotal ?? selectedOrder.totalAmount + currentDiscount);
      const nextTotal = Math.max(0, Math.round((base - discount) * 100) / 100);
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        subtotal: base,
        discountAmount: discount,
        totalAmount: nextTotal,
        total: nextTotal,
        updatedAt: serverTimestamp()
      });
    }, "Discount applied");
  }

  async function handleMarkPriority() {
    if (!selectedOrder) return;
    await runAction(async () => {
      const snap = await getDoc(doc(staffDb, "orders", selectedOrder.id));
      if (!snap.exists()) throw new Error("Order not found");
      const current = snap.data() as Record<string, unknown>;
      const nextPriority = !(current.priority === true);
      await updateDoc(doc(staffDb, "orders", selectedOrder.id), {
        priority: nextPriority,
        priorityAt: nextPriority ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
    }, "Priority updated");
  }

  return (
    <section className="rounded-2xl border border-theme-border bg-theme-surface shadow-card">
      <header className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text-primary">Manager Order Management</h3>
            <p className="text-xs text-theme-text-secondary">
              Realtime updates · {filteredOrders.length} matching of {orders.length} total
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

      <div className="border-b border-theme-border px-4 py-3 md:px-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === item.key
                  ? "bg-theme-primary text-white"
                  : "border border-theme-border bg-theme-card text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text-primary"
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by token, customer, phone, source or table"
          className="w-full rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-primary"
        />
      </div>

      <div className="grid min-h-[540px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-theme-card text-left text-xs uppercase tracking-wide text-theme-text-secondary">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Type/Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-theme-text-secondary">
                    Loading orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-theme-text-secondary">
                    No orders match current filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const status = safeStatus(order);
                  const priority = (order as Record<string, unknown>).priority === true;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrderId(order.id);
                        setEditCustomerName(order.customerName ?? "");
                        setEditCustomerPhone(order.customerPhone ?? "");
                        setEditNotes((order as Record<string, unknown>).notes?.toString() ?? "");
                        setTransferTableId(order.tableId ?? "");
                      }}
                      className={[
                        "cursor-pointer border-t border-theme-border transition hover:bg-theme-hover",
                        selectedOrderId === order.id ? "bg-theme-primary/10" : "",
                        priority ? "border-l-4 border-l-rose-500" : ""
                      ].join(" ")}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">#{order.tokenNumber ?? order.id.slice(-6)}</p>
                        <p className="text-xs text-theme-text-secondary">{order.id.slice(0, 10)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="capitalize">{order.orderType ?? "general"}</p>
                        <p className="text-xs text-theme-text-secondary capitalize">{order.source ?? "direct"}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{status || "unknown"}</td>
                      <td className="px-4 py-3">{order.tableName ?? (order.tableNumber ? `Table ${order.tableNumber}` : "—")}</td>
                      <td className="px-4 py-3">
                        <p>{order.customerName ?? "Walk-in"}</p>
                        <p className="text-xs text-theme-text-secondary">{order.customerPhone ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(order.totalAmount)}</td>
                      <td className="px-4 py-3 text-xs text-theme-text-secondary">{formatDateTime(order.updatedAt ?? order.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="border-t border-theme-border p-4 xl:border-l xl:border-t-0">
          {!selectedOrder ? (
            <p className="text-sm text-theme-text-secondary">Select an order to manage actions.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs text-theme-text-secondary">Selected Order</p>
                <p className="text-lg font-bold">#{selectedOrder.tokenNumber ?? selectedOrder.id.slice(-6)}</p>
                <p className="text-xs text-theme-text-secondary capitalize">
                  {selectedOrder.orderType ?? "general"} · {selectedOrder.source ?? "direct"}
                </p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(selectedOrder.totalAmount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => void handleEdit()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Edit</button>
                <button type="button" disabled={busy} onClick={() => void handleCancel()} className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-300">Cancel</button>
                <button type="button" disabled={busy} onClick={() => void handleMerge()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Merge</button>
                <button type="button" disabled={busy} onClick={() => void handleSplitBill()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Split Bill</button>
                <button type="button" disabled={busy} onClick={() => void handleTransferTable()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Transfer Table</button>
                <button type="button" disabled={busy} onClick={() => void handleAssignWaiter()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Assign Waiter</button>
                <button type="button" disabled={busy} onClick={() => void handleReprintBill()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Reprint Bill</button>
                <button type="button" disabled={busy} onClick={() => void handleReprintKot()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Reprint KOT</button>
                <button type="button" disabled={busy} onClick={() => void handleApplyDiscount()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Apply Discount</button>
                <button type="button" disabled={busy} onClick={() => void handleMarkPriority()} className="rounded-lg border border-theme-border bg-theme-card px-2 py-2 text-xs font-semibold">Mark Priority</button>
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Edit Order</p>
                <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="Customer name" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                <input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(e.target.value)} placeholder="Customer phone" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
              </div>

              <div className="space-y-2 rounded-xl border border-theme-border bg-theme-card p-3">
                <p className="text-xs font-semibold uppercase text-theme-text-secondary">Advanced Actions</p>
                <select value={mergeWithOrderId} onChange={(e) => setMergeWithOrderId(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Merge with order…</option>
                  {mergeCandidates.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{order.tokenNumber ?? order.id.slice(-6)} · {formatMoney(order.totalAmount)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={2} max={6} value={splitParts} onChange={(e) => setSplitParts(Number(e.target.value) || 2)} placeholder="Split parts" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                  <input type="number" min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="Discount amount" className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
                </div>
                <select value={transferTableId} onChange={(e) => setTransferTableId(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Transfer to table…</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.displayName || `Table ${table.number ?? table.id}`}
                    </option>
                  ))}
                </select>
                <select value={assignWaiterUid} onChange={(e) => setAssignWaiterUid(e.target.value)} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs">
                  <option value="">Assign waiter…</option>
                  {waiterOptions.map((waiter) => (
                    <option key={waiter.uid} value={waiter.uid}>
                      {waiter.name}
                    </option>
                  ))}
                </select>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancel reason" rows={2} className="w-full rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-xs" />
              </div>
            </div>
          )}
        </aside>
      </div>

      <Modal open={Boolean(selectedOrderId) && busy} onClose={() => {}} title="Processing..." widthClass="max-w-sm">
        <div className="p-5 text-sm text-theme-text-secondary">Applying order update…</div>
      </Modal>
      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </section>
  );
}
