import type { StaffOrderRow } from "@/services/orders";
import { isOrderPaid } from "@/lib/cashier-order-filters";
import { kitchenStatusLabel } from "@/lib/cashier-order-filters";

type Props = {
  visible: boolean;
  order: StaffOrderRow | null;
  busy: boolean;
  onClose: () => void;
  onPrint: () => void;
  onPayment: () => void;
  onAccept: () => void;
};

export function PosOrderDetailModal({ visible, order, busy, onClose, onPrint, onPayment, onAccept }: Props) {
  if (!visible || !order) return null;
  const paid = isOrderPaid(order.paymentStatus);

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal pos-order-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pos-modal-header">
          <h2>Order #{order.tokenNumber ?? order.id.slice(0, 8)}</h2>
          <button type="button" className="pos-modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="pos-modal-body">
          <p><strong>Status:</strong> {kitchenStatusLabel(order.status, order.canonicalStatus)}</p>
          <p><strong>Customer:</strong> {order.customer?.name || "Guest"} · {order.customer?.phone || "—"}</p>
          <p><strong>Total:</strong> ₹{order.totalAmount.toFixed(2)}</p>
          <ul className="pos-order-items">
            {order.items.map((it) => (
              <li key={it.id || it.name}>{it.qty}× {it.name} — ₹{(it.price * it.qty).toFixed(2)}</li>
            ))}
          </ul>
        </div>
        <footer className="pos-modal-footer">
          <button type="button" className="pos-action-btn" disabled={busy} onClick={onPrint}>Print</button>
          {!paid ? (
            <>
              <button type="button" className="pos-action-btn" disabled={busy} onClick={onAccept}>Accept</button>
              <button type="button" className="pos-action-btn pay" disabled={busy} onClick={onPayment}>Payment</button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
