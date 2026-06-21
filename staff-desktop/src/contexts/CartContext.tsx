import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode
} from "react";
import { createCartReducer } from "@/lib/cart-store";
import type { PosCartSyncState, PosDiscountType } from "@shared/types/pos-sync-state";

type CartContextValue = {
  state: PosCartSyncState;
  addItem: (product: { id: string; name: string; price: number }) => void;
  updateCartItem: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  applyDiscount: (discountType: PosDiscountType, value?: number) => void;
  clearCart: () => void;
  holdOrder: () => void;
  newOrder: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const cartEngine = createCartReducer();

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useReducer((_prev: PosCartSyncState, next: PosCartSyncState) => next, cartEngine.getState());

  const addItem = useCallback((product: { id: string; name: string; price: number }) => {
    setState(cartEngine.addItem(product.id, product.name, product.price));
  }, []);

  const updateCartItem = useCallback((id: string, delta: number) => {
    setState(cartEngine.updateCartItem(id, delta));
  }, []);

  const removeItem = useCallback((id: string) => {
    setState(cartEngine.removeItem(id));
  }, []);

  const applyDiscount = useCallback((discountType: PosDiscountType, value?: number) => {
    setState(cartEngine.applyDiscount(discountType, value));
  }, []);

  const clearCart = useCallback(() => {
    setState(cartEngine.clearCart());
  }, []);

  const holdOrder = useCallback(() => {
    setState(cartEngine.holdOrder());
  }, []);

  const newOrder = useCallback(() => {
    setState(cartEngine.newOrder());
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      state,
      addItem,
      updateCartItem,
      removeItem,
      applyDiscount,
      clearCart,
      holdOrder,
      newOrder
    }),
    [state, addItem, updateCartItem, removeItem, applyDiscount, clearCart, holdOrder, newOrder]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
