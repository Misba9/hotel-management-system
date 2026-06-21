import {
  createEmptyCartSyncState,
  TAX_RATE,
  type PosCartItem,
  type PosCartSyncState,
  type PosDiscountType
} from "@shared/types/pos-sync-state";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type DiscountInputs = {
  percentRate: number;
  flatAmount: number;
  couponAmount: number;
};

export function createCartReducer() {
  let state: PosCartSyncState = createEmptyCartSyncState();
  let discountInputs: DiscountInputs = { percentRate: 0, flatAmount: 0, couponAmount: 0 };

  function recomputeTotals(): void {
    const subtotal = round2(state.cart.reduce((sum, line) => sum + line.price * line.quantity, 0));
    const percentOff = round2(subtotal * (discountInputs.percentRate / 100));
    const flatOff = round2(discountInputs.flatAmount);
    const couponOff = round2(discountInputs.couponAmount);
    const discounted = Math.max(0, subtotal - percentOff - flatOff - couponOff);
    const tax = round2(discounted * TAX_RATE);
    const total = round2(discounted + tax);

    state = {
      ...state,
      subtotal,
      tax,
      total,
      discounts: [
        { type: "percent", value: percentOff, label: "Percent" },
        { type: "flat", value: flatOff, label: "Flat" },
        { type: "coupon", value: couponOff, label: "Coupon" }
      ]
    };
  }

  return {
    getState(): PosCartSyncState {
      return structuredClone(state);
    },
    addItem(productId: string, name: string, price: number): PosCartSyncState {
      if (!name.trim() || price < 0) return state;
      const existing = state.cart.find((line) => line.id === productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.cart.push({ id: productId, name: name.trim(), quantity: 1, price });
      }
      if (state.orderStatus === "cancelled") state.orderStatus = "new";
      recomputeTotals();
      return structuredClone(state);
    },
    updateCartItem(id: string, delta: number): PosCartSyncState {
      const line = state.cart.find((item) => item.id === id);
      if (!line) return state;
      line.quantity += delta;
      if (line.quantity <= 0) {
        state.cart = state.cart.filter((item) => item.id !== id);
      }
      recomputeTotals();
      return structuredClone(state);
    },
    removeItem(id: string): PosCartSyncState {
      state.cart = state.cart.filter((item) => item.id !== id);
      recomputeTotals();
      return structuredClone(state);
    },
    applyDiscount(discountType: PosDiscountType, value?: number): PosCartSyncState {
      if (discountType === "percent") {
        discountInputs.percentRate = value ?? (discountInputs.percentRate || 10);
      } else if (discountType === "flat") {
        discountInputs.flatAmount = value ?? (discountInputs.flatAmount || 40);
      } else if (discountType === "coupon") {
        discountInputs.couponAmount = value ?? (discountInputs.couponAmount || 0.5);
      }
      recomputeTotals();
      return structuredClone(state);
    },
    clearCart(): PosCartSyncState {
      state.cart = [];
      state.orderStatus = "cancelled";
      discountInputs = { percentRate: 0, flatAmount: 0, couponAmount: 0 };
      recomputeTotals();
      return structuredClone(state);
    },
    holdOrder(): PosCartSyncState {
      state.orderStatus = "held";
      return structuredClone(state);
    },
    newOrder(): PosCartSyncState {
      state = createEmptyCartSyncState();
      discountInputs = { percentRate: 0, flatAmount: 0, couponAmount: 0 };
      return structuredClone(state);
    }
  };
}

export type CartLineInput = Pick<PosCartItem, "id" | "name" | "price" | "quantity">;

export function cartLinesToFirestoreItems(lines: CartLineInput[]) {
  return lines.map((line) => ({
    productId: line.id,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
    qty: line.quantity
  }));
}
