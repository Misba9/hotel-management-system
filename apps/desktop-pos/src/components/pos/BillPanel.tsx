import type { PlatformTab } from "@/lib/pos-theme";

type CartLine = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

type Props = {
  platform: PlatformTab;
  cart: CartLine[];
  subtotal: number;
  tax: number;
  roundOff: number;
  total: number;
  discountMode: "percent" | "flat" | "coupon";
  onDiscountModeChange: (mode: "percent" | "flat" | "coupon") => void;
  onQtyChange: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  onHold: () => void;
  onCancel: () => void;
  checkingOut: boolean;
  statusMessage: string;
  statusKind: "idle" | "success" | "error";
};

const PLATFORM_LABEL: Record<PlatformTab, string> = {
  parcel: "Parcel",
  swiggy: "Swiggy",
  zomato: "Zomato",
  online: "Online",
  waiter: "Waiter"
};

export function BillPanel({
  platform,
  cart,
  subtotal,
  tax,
  roundOff,
  total,
  discountMode,
  onDiscountModeChange,
  onQtyChange,
  onRemove,
  onCheckout,
  onHold,
  onCancel,
  checkingOut,
  statusMessage,
  statusKind
}: Props) {
  return (
    <aside className="pos-bill">
      <div className="pos-bill-customer">
        <select className="pos-bill-select" defaultValue="">
          <option value="">+ New Customer — Add customer details</option>
        </select>
      </div>

      <div className="pos-bill-channel">
        <span className="pos-bill-tag">{PLATFORM_LABEL[platform]}</span>
        <p className="pos-bill-note">
          Cashier can only create new Parcel orders. Other channels sync automatically.
        </p>
      </div>

      <div className="pos-bill-items">
        {cart.length === 0 ? (
          <p className="pos-bill-empty">Add items from the menu to start a bill.</p>
        ) : (
          cart.map((line) => (
            <div key={line.productId} className="pos-bill-line">
              <div className="pos-bill-line-info">
                <strong>{line.name}</strong>
                <span>₹{(line.price * line.quantity).toFixed(2)}</span>
              </div>
              <div className="pos-bill-line-actions">
                <button type="button" className="pos-qty-btn" onClick={() => onQtyChange(line.productId, -1)}>
                  −
                </button>
                <span>{line.quantity}</span>
                <button type="button" className="pos-qty-btn add" onClick={() => onQtyChange(line.productId, 1)}>
                  +
                </button>
                <button type="button" className="pos-bill-remove" onClick={() => onRemove(line.productId)}>
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pos-discount-tabs">
        {(["percent", "flat", "coupon"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`pos-discount-tab${discountMode === mode ? " active" : ""}`}
            onClick={() => onDiscountModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="pos-bill-totals">
        <div className="pos-total-row">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="pos-total-row">
          <span>Tax [5%]</span>
          <span>₹{tax.toFixed(2)}</span>
        </div>
        <div className="pos-total-row">
          <span>Round Off</span>
          <span>₹{roundOff.toFixed(2)}</span>
        </div>
        <div className="pos-total-row grand">
          <span>Total</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      {statusMessage ? (
        <p className={`pos-bill-status ${statusKind}`}>{statusMessage}</p>
      ) : null}

      <button
        type="button"
        className="pos-pay-btn"
        disabled={cart.length === 0 || checkingOut}
        onClick={onCheckout}
      >
        {checkingOut ? "Processing…" : "Select payment method"}
      </button>

      <div className="pos-bill-actions-row">
        <button type="button" className="pos-action-btn draft">
          Save Draft
        </button>
        <button type="button" className="pos-action-btn hold" onClick={onHold}>
          Hold Order
        </button>
      </div>

      <button type="button" className="pos-cancel-btn" onClick={onCancel}>
        Cancel Order
      </button>

      <button type="button" className="pos-bill-fab" aria-label="Quick add">
        +
      </button>
    </aside>
  );
}
