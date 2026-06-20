import type { StaffOrderRow } from "@/services/orders";
import { isOrderPaid } from "@/lib/cashier-order-filters";

type Props = {
  visible: boolean;
  orders: StaffOrderRow[];
  loading: boolean;
  todayCount: number;
  onClose: () => void;
  onOpen: (order: StaffOrderRow) => void;
  onEdit: (order: StaffOrderRow) => void;
  onPrint: (order: StaffOrderRow) => void;
  onDuplicate: (order: StaffOrderRow) => void;
  onCancel: (order: StaffOrderRow, reason: string) => void;
};

export function RecentParcelOrdersButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <button type="button" className="pos-recent-btn" onClick={onPress}>
      Recent Orders <span className="pos-recent-badge">{count}</span>
    </button>
  );
}

export function PosRecentParcelDrawer({
  visible,
  orders,
  loading,
  todayCount,
  onClose,
  onOpen,
  onEdit,
  onPrint,
  onDuplicate,
  onCancel
}: Props) {
  if (!visible) return null;

  return (
    <div className="pos-drawer-overlay" onClick={onClose}>
      <aside className="pos-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="pos-drawer-header">
          <h2>Today&apos;s parcel orders ({todayCount})</h2>
          <button type="button" onClick={onClose}>✕</button>
        </header>
        {loading ? (
          <p className="pos-platform-empty">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="pos-platform-empty">No parcel orders today.</p>
        ) : (
          <div className="pos-drawer-list">
            {orders.map((order) => (
              <article key={order.id} className="pos-drawer-row">
                <div>
                  <strong>#{order.tokenNumber ?? order.id.slice(0, 8)}</strong>
                  <span>{order.customer?.name || "Guest"} · ₹{order.totalAmount.toFixed(0)}</span>
                  <span>{isOrderPaid(order.paymentStatus) ? "Paid" : "Pending"}</span>
                </div>
                <div className="pos-platform-actions">
                  <button type="button" className="pos-action-btn" onClick={() => onOpen(order)}>Open</button>
                  <button type="button" className="pos-action-btn" onClick={() => onEdit(order)}>Edit</button>
                  <button type="button" className="pos-action-btn" onClick={() => onPrint(order)}>Print</button>
                  <button type="button" className="pos-action-btn" onClick={() => onDuplicate(order)}>Duplicate</button>
                  <button type="button" className="pos-action-btn" onClick={() => onCancel(order, "Customer request")}>Cancel</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
