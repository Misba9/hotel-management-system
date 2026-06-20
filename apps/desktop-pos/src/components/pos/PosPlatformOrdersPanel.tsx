import type { StaffOrderRow } from "@/services/orders";
import { isOrderPaid, kitchenStatusLabel } from "@/lib/cashier-order-filters";
import { getOrderSourceMeta, isOrderCancelled } from "@/lib/pos/order-source";
import type { OrderStatusFilter } from "@/lib/pos/order-source";
import type { PlatformTab } from "@/lib/pos/cashier-pos-store";
import { PosPlatformStatusFilter } from "./PosPlatformStatusFilter";

type Props = {
  platform: PlatformTab;
  orders: StaffOrderRow[];
  loading: boolean;
  search: string;
  statusFilter: OrderStatusFilter;
  statusCounts: Record<OrderStatusFilter, number>;
  onStatusChange: (status: OrderStatusFilter) => void;
  onSearchChange: (q: string) => void;
  onOpenOrder: (order: StaffOrderRow) => void;
  onPrint?: (order: StaffOrderRow) => void;
  onPayment?: (order: StaffOrderRow) => void;
};

const PLATFORM_TITLES: Record<PlatformTab, string> = {
  parcel: "Parcel Orders",
  swiggy: "Swiggy Orders",
  zomato: "Zomato Orders",
  online: "Online Orders",
  waiter: "Waiter Orders"
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(0) : "0"}`;
}

function formatTime(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PosPlatformOrdersPanel({
  platform,
  orders,
  loading,
  search,
  statusFilter,
  statusCounts,
  onStatusChange,
  onSearchChange,
  onOpenOrder,
  onPrint,
  onPayment
}: Props) {
  return (
    <section className="pos-platform-panel">
      <header className="pos-platform-header">
        <div>
          <h2>{PLATFORM_TITLES[platform]}</h2>
          {platform !== "parcel" ? (
            <p className="pos-platform-hint">Auto-sync from Firestore · Real-time updates</p>
          ) : null}
        </div>
        <input
          className="pos-platform-search"
          placeholder="Search orders…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </header>

      <PosPlatformStatusFilter
        platform={platform}
        activeStatus={statusFilter}
        statusCounts={statusCounts}
        onStatusChange={onStatusChange}
      />

      {loading ? (
        <p className="pos-platform-empty">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="pos-platform-empty">No orders match this filter.</p>
      ) : (
        <div className="pos-platform-list">
          {orders.map((order) => {
            const meta = getOrderSourceMeta(order);
            const paid = isOrderPaid(order.paymentStatus);
            const cancelled = isOrderCancelled(order);
            return (
              <article key={order.id} className="pos-platform-card">
                <div className="pos-platform-card-top">
                  <span className="pos-platform-source" style={{ color: meta.color }}>
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="pos-platform-time">{formatTime(order.createdAt)}</span>
                </div>
                <div className="pos-platform-card-body">
                  <strong>
                    #{order.tokenNumber ?? order.id.slice(0, 8)} · {order.customer?.name || "Guest"}
                  </strong>
                  <span>{order.items.length} items · {formatMoney(order.totalAmount)}</span>
                  <span className={`pos-platform-status ${cancelled ? "cancelled" : paid ? "paid" : ""}`}>
                    {kitchenStatusLabel(order.status, order.canonicalStatus)}
                  </span>
                </div>
                <div className="pos-platform-actions">
                  <button type="button" className="pos-action-btn" onClick={() => onOpenOrder(order)}>
                    View
                  </button>
                  {onPrint ? (
                    <button type="button" className="pos-action-btn" onClick={() => onPrint(order)}>
                      Print
                    </button>
                  ) : null}
                  {!paid && !cancelled && onPayment ? (
                    <button type="button" className="pos-action-btn pay" onClick={() => onPayment(order)}>
                      Payment
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
