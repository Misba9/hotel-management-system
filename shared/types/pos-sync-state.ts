/** Shared cashier mirror state — Desktop POS is source of truth for cart only. Menu comes from Firestore. */

export type PosDiscountType = "percent" | "flat" | "coupon";

export type PosOrderStatus = "new" | "held" | "paid" | "cancelled";

export type PosCartItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type PosDiscount = {
  type: PosDiscountType;
  value: number;
  label: string;
};

/** WebSocket-synced cart state (no menu — each client loads menu from Firebase). */
export interface PosCartSyncState {
  cart: PosCartItem[];
  discounts: PosDiscount[];
  subtotal: number;
  tax: number;
  total: number;
  orderStatus: PosOrderStatus;
}

/** @deprecated Use PosCartSyncState — kept as alias for existing imports */
export type POSState = PosCartSyncState;

export type PosRemoteAction =
  | { type: "add-item"; productId: string; name: string; price: number }
  | { type: "update-cart-item"; id: string; delta: number }
  | { type: "remove-item"; id: string }
  | { type: "apply-discount"; discountType: PosDiscountType; value?: number }
  | { type: "clear-cart" }
  | { type: "hold-order" }
  | { type: "new-order" };

export type JoinStaffPayload = {
  role: "cashier";
  stationId: string;
};

export const POS_SYNC_EVENTS = {
  JOIN_STAFF: "join-staff",
  FULL_STATE_SYNC: "full-state-sync",
  STATE_UPDATE: "state-update",
  REMOTE_ACTION: "remote-action"
} as const;

export const TAX_RATE = 0.1;

export function createEmptyCartSyncState(): PosCartSyncState {
  return {
    cart: [],
    discounts: [
      { type: "percent", value: 0, label: "Percent" },
      { type: "flat", value: 0, label: "Flat" },
      { type: "coupon", value: 0, label: "Coupon" }
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
    orderStatus: "new"
  };
}

/** @deprecated */
export const createEmptyPosState = createEmptyCartSyncState;
