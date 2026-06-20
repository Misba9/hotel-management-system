import { useMemo, useState } from "react";
import type { StaffOrderRow } from "@/services/orders";
import {
  CASHIER_PAYMENT_METHODS,
  computePosBillTotals,
  type PaymentMethodId,
  PAYMENT_METHOD_LABELS
} from "@/services/restaurant-orders";
import type { PosSettingsDoc } from "@shared/types/pos-settings";
import { isOrderPaid } from "@/lib/cashier-order-filters";
import { loadHeldOrders, type HeldOrder } from "@/lib/pos/hold-orders-store";
import type { CartLine, DiscountMode, PosOrderChannel, SplitPaymentLine } from "@/components/pos/pos-types";
import { POS_ITEM_MODIFICATIONS } from "@/components/pos/pos-types";
import type { FloorTable } from "@/hooks/use-tables";

export type BillMode = "existing" | "new";

type Props = {
  mode: BillMode;
  selectedOrder: StaffOrderRow | null;
  cartLines: CartLine[];
  orderChannel: PosOrderChannel;
  customerName: string;
  phone: string;
  guestCount: string;
  gstNumber: string;
  address: string;
  paymentMethod: PaymentMethodId | null;
  taxPercent: number;
  posSettings: PosSettingsDoc;
  discountPercent: number;
  discountFlatAmount: number;
  couponCode: string;
  couponError: string | null;
  cashReceived: string;
  serviceChargePercent: number;
  busy: boolean;
  discountMode: DiscountMode;
  splitLines: SplitPaymentLine[];
  onDiscountModeChange: (m: DiscountMode) => void;
  onSplitChange: (lines: SplitPaymentLine[]) => void;
  onCouponCodeChange: (v: string) => void;
  onApplyCoupon: () => void;
  onCashReceivedChange: (v: string) => void;
  onHold: () => void;
  onResumeHeld: (held: HeldOrder) => void;
  onCustomerNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onGuestCountChange: (v: string) => void;
  onGstChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onOrderChannelChange: (t: PosOrderChannel) => void;
  onPaymentMethod: (m: PaymentMethodId) => void;
  onDiscountChange: (v: number) => void;
  onServiceChargeChange: (v: number) => void;
  onCartQtyChange: (menuItemId: string, delta: number) => void;
  onCartLineModify: (menuItemId: string, updates: { modifications?: string[]; note?: string }) => void;
  onRemoveCartLine: (menuItemId: string) => void;
  onPayAndComplete: () => void;
  onPayRazorpay: () => void;
  onAcceptPayment: () => void;
  onPrint: () => void;
  onRefund: () => void;
  onCancelOrder: () => void;
  onSaveDraft: () => void;
  tables?: FloorTable[];
  selectedTableId?: string | null;
  onSelectTable?: (table: FloorTable) => void;
};

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function enabledMethods(settings: PosSettingsDoc): PaymentMethodId[] {
  const enabled = new Set(settings.enabledPaymentMethods ?? []);
  return CASHIER_PAYMENT_METHODS.filter((m) => enabled.has(m as (typeof settings.enabledPaymentMethods)[number]));
}

export function BillPaymentPanel(props: Props) {
  const [showCustomer, setShowCustomer] = useState(true);
  const [modifyLineId, setModifyLineId] = useState<string | null>(null);
  const heldOrders = loadHeldOrders();

  const subtotal = useMemo(
    () => Math.round(props.cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100,
    [props.cartLines]
  );

  const bill = useMemo(() => {
    if (props.mode === "existing" && props.selectedOrder) {
      return computePosBillTotals(
        props.selectedOrder.totalAmount,
        props.taxPercent,
        0,
        props.serviceChargePercent,
        0
      );
    }
    const flat = props.discountMode === "flat" || props.discountMode === "coupon" ? props.discountFlatAmount : 0;
    const pct = props.discountMode === "percent" ? props.discountPercent : 0;
    return computePosBillTotals(subtotal, props.taxPercent, pct, props.serviceChargePercent, flat);
  }, [props, subtotal]);

  const changeDue = useMemo(() => {
    if (props.paymentMethod !== "cash") return 0;
    const received = Number(props.cashReceived) || 0;
    return Math.max(0, Math.round((received - bill.grandTotal) * 100) / 100);
  }, [props.paymentMethod, props.cashReceived, bill.grandTotal]);

  const lines = props.mode === "existing" && props.selectedOrder ? null : props.cartLines;
  const isExistingPaid = props.selectedOrder ? isOrderPaid(props.selectedOrder.paymentStatus) : false;

  return (
    <aside className="pos-bill">
      <div className="pos-bill-customer">
        <button type="button" className="pos-bill-customer-toggle" onClick={() => setShowCustomer((v) => !v)}>
          {showCustomer ? "▼" : "▶"} Customer details
        </button>
        {showCustomer ? (
          <div className="pos-bill-customer-fields">
            <input placeholder="Customer name" value={props.customerName} onChange={(e) => props.onCustomerNameChange(e.target.value)} />
            <input placeholder="Phone" value={props.phone} onChange={(e) => props.onPhoneChange(e.target.value)} />
            <input placeholder="Guest count" value={props.guestCount} onChange={(e) => props.onGuestCountChange(e.target.value)} />
            <input placeholder="GST number" value={props.gstNumber} onChange={(e) => props.onGstChange(e.target.value)} />
            <input placeholder="Address" value={props.address} onChange={(e) => props.onAddressChange(e.target.value)} />
          </div>
        ) : null}
      </div>

      {props.mode === "new" ? (
        <div className="pos-bill-channel">
          {(["parcel", "dine_in"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              className={`pos-bill-tag${props.orderChannel === ch ? " active" : ""}`}
              onClick={() => props.onOrderChannelChange(ch)}
            >
              {ch === "parcel" ? "Parcel" : "Dine-In"}
            </button>
          ))}
        </div>
      ) : props.selectedOrder ? (
        <div className="pos-bill-existing-header">
          <strong>Order #{props.selectedOrder.tokenNumber ?? props.selectedOrder.id.slice(0, 8)}</strong>
          <span>{isExistingPaid ? "Paid" : "Payment pending"}</span>
        </div>
      ) : null}

      <div className="pos-bill-items">
        {props.mode === "existing" && props.selectedOrder ? (
          props.selectedOrder.items.map((it) => (
            <div key={it.id || it.name} className="pos-bill-line">
              <div className="pos-bill-line-info">
                <strong>{it.name}</strong>
                <span>{formatMoney(it.price * it.qty)}</span>
              </div>
              <span className="pos-bill-line-qty">×{it.qty}</span>
            </div>
          ))
        ) : lines && lines.length > 0 ? (
          lines.map((line) => (
            <div key={line.menuItemId} className="pos-bill-line">
              <div className="pos-bill-line-info">
                <strong>{line.name}</strong>
                <span>{formatMoney(line.unitPrice * line.qty)}</span>
                {line.modifications?.length || line.note ? (
                  <small>{[...(line.modifications ?? []), line.note].filter(Boolean).join(" · ")}</small>
                ) : null}
              </div>
              <div className="pos-bill-line-actions">
                <button type="button" className="pos-qty-btn" onClick={() => props.onCartQtyChange(line.menuItemId, -1)}>−</button>
                <span>{line.qty}</span>
                <button type="button" className="pos-qty-btn add" onClick={() => props.onCartQtyChange(line.menuItemId, 1)}>+</button>
                <button type="button" className="pos-bill-modify" onClick={() => setModifyLineId(line.menuItemId)}>✎</button>
                <button type="button" className="pos-bill-remove" onClick={() => props.onRemoveCartLine(line.menuItemId)}>✕</button>
              </div>
            </div>
          ))
        ) : (
          <p className="pos-bill-empty">Add items from the menu to start a bill.</p>
        )}
      </div>

      {props.mode === "new" ? (
        <>
          <div className="pos-discount-tabs">
            {(["percent", "flat", "coupon"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`pos-discount-tab${props.discountMode === mode ? " active" : ""}`}
                onClick={() => props.onDiscountModeChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          {props.discountMode === "percent" ? (
            <input
              type="number"
              className="pos-bill-input"
              placeholder="Discount %"
              value={props.discountPercent || ""}
              onChange={(e) => props.onDiscountChange(Number(e.target.value))}
            />
          ) : null}
          {props.discountMode === "flat" ? (
            <input
              type="number"
              className="pos-bill-input"
              placeholder="Flat discount ₹"
              value={props.discountFlatAmount || ""}
              onChange={(e) => props.onDiscountChange(Number(e.target.value))}
            />
          ) : null}
          {props.discountMode === "coupon" ? (
            <div className="pos-coupon-row">
              <input
                className="pos-bill-input"
                placeholder="Coupon code"
                value={props.couponCode}
                onChange={(e) => props.onCouponCodeChange(e.target.value)}
              />
              <button type="button" className="pos-action-btn" onClick={props.onApplyCoupon}>Apply</button>
            </div>
          ) : null}
          {props.couponError ? <p className="pos-bill-error">{props.couponError}</p> : null}
        </>
      ) : null}

      <div className="pos-bill-totals">
        <div className="pos-total-row"><span>Subtotal</span><span>{formatMoney(bill.subtotal)}</span></div>
        {bill.discountAmount > 0 ? (
          <div className="pos-total-row"><span>Discount</span><span>−{formatMoney(bill.discountAmount)}</span></div>
        ) : null}
        <div className="pos-total-row"><span>Tax [{bill.taxPercent}%]</span><span>{formatMoney(bill.taxAmount)}</span></div>
        <div className="pos-total-row grand"><span>Total</span><span>{formatMoney(bill.grandTotal)}</span></div>
      </div>

      {!isExistingPaid ? (
        <>
          <div className="pos-payment-methods">
            {enabledMethods(props.posSettings).map((m) => (
              <button
                key={m}
                type="button"
                className={`pos-payment-btn${props.paymentMethod === m ? " active" : ""}`}
                onClick={() => props.onPaymentMethod(m)}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
          {props.paymentMethod === "cash" ? (
            <input
              className="pos-bill-input"
              placeholder="Cash received"
              value={props.cashReceived}
              onChange={(e) => props.onCashReceivedChange(e.target.value)}
            />
          ) : null}
          {props.paymentMethod === "cash" && changeDue > 0 ? (
            <p className="pos-change-due">Change: {formatMoney(changeDue)}</p>
          ) : null}
          {props.paymentMethod === "upi" && props.posSettings.upiVpa ? (
            <p className="pos-upi-vpa">Pay to: {props.posSettings.upiVpa}</p>
          ) : null}
        </>
      ) : null}

      {props.mode === "new" ? (
        <button type="button" className="pos-pay-btn" disabled={props.busy || props.cartLines.length === 0} onClick={props.onPayAndComplete}>
          {props.busy ? "Processing…" : props.paymentMethod ? `Pay · ${PAYMENT_METHOD_LABELS[props.paymentMethod]}` : "Select payment method"}
        </button>
      ) : !isExistingPaid ? (
        <button type="button" className="pos-pay-btn" disabled={props.busy || !props.paymentMethod} onClick={props.onAcceptPayment}>
          {props.busy ? "Processing…" : "Accept payment"}
        </button>
      ) : (
        <button type="button" className="pos-pay-btn secondary" onClick={props.onPrint}>Reprint receipt</button>
      )}

      <div className="pos-bill-actions-row">
        <button type="button" className="pos-action-btn draft" onClick={props.onSaveDraft}>Save Draft</button>
        <button type="button" className="pos-action-btn hold" onClick={props.onHold}>Hold Order</button>
      </div>

      {heldOrders.length > 0 ? (
        <div className="pos-held-list">
          <span className="pos-label">Held orders</span>
          {heldOrders.slice(0, 5).map((h) => (
            <button key={h.id} type="button" className="pos-held-row" onClick={() => props.onResumeHeld(h)}>
              {h.label} · {h.cart.length} items
            </button>
          ))}
        </div>
      ) : null}

      <button type="button" className="pos-cancel-btn" onClick={props.onCancelOrder}>Cancel Order</button>

      {modifyLineId ? (
        <div className="pos-modal-overlay" onClick={() => setModifyLineId(null)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modify item</h3>
            <div className="pos-mod-chips">
              {POS_ITEM_MODIFICATIONS.map((mod) => {
                const line = props.cartLines.find((l) => l.menuItemId === modifyLineId);
                const active = line?.modifications?.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    className={`pos-mod-chip${active ? " active" : ""}`}
                    onClick={() => {
                      const cur = line?.modifications ?? [];
                      const next = active ? cur.filter((m) => m !== mod) : [...cur, mod];
                      props.onCartLineModify(modifyLineId, { modifications: next });
                    }}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
            <input
              className="pos-bill-input"
              placeholder="Special note"
              defaultValue={props.cartLines.find((l) => l.menuItemId === modifyLineId)?.note ?? ""}
              onBlur={(e) => props.onCartLineModify(modifyLineId, { note: e.target.value })}
            />
            <button type="button" className="pos-pay-btn" onClick={() => setModifyLineId(null)}>Done</button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
