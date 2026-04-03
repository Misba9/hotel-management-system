"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { Product } from "@/lib/menu-data-types";
import { useToast } from "@/components/providers/toast-provider";
import { buildUserHeaders } from "@/lib/user-session";
import {
  type CartLine,
  type CartPayload,
  CART_STORAGE_KEY,
  computeLineItemCount,
  computeSubtotal,
  computeTotalAfterDiscount,
  getItemQuantity,
  loadPersistedCart,
  persistCart
} from "@/lib/cart";
import { auth } from "@shared/firebase/client";

export type CartContextValue = {
  items: CartLine[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  discount: number;
  couponCode: string;
  total: number;
  itemQty: (productId: string) => number;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  applyCoupon: (code: string, discountAmount: number) => void;
  clearCoupon: () => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [readyToSync, setReadyToSync] = useState(false);
  const { showToast } = useToast();

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (product: Product) =>
      setItems((prev) => {
        const exists = prev.find((item) => item.id === product.id);
        if (exists) {
          showToast({
            title: "Updated cart",
            description: `${product.name} quantity increased`
          });
          return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
        }
        showToast({
          title: "Added to cart",
          description: `${product.name} is now in your cart`
        });
        return [
          ...prev,
          { id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 }
        ];
      }),
    [showToast]
  );

  const removeItem = useCallback(
    (productId: string) =>
      setItems((prev) => {
        const item = prev.find((entry) => entry.id === productId);
        if (item) {
          showToast({
            title: "Removed from cart",
            description: item.name
          });
        }
        return prev.filter((entry) => entry.id !== productId);
      }),
    [showToast]
  );

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((item) => (item.id === productId ? { ...item, qty } : item))
        .filter((item) => item.qty > 0)
    );
  }, []);

  const applyCoupon = useCallback((code: string, discountAmount: number) => {
    setCouponCode(code.toUpperCase());
    setDiscount(Math.max(0, Math.floor(discountAmount)));
  }, []);

  const clearCoupon = useCallback(() => {
    setCouponCode("");
    setDiscount(0);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode("");
    setDiscount(0);
    showToast({
      title: "Cart cleared",
      description: "Your cart is now empty"
    });
  }, [showToast]);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(CART_STORAGE_KEY) : null;
    const parsed = loadPersistedCart(raw);
    if (parsed) {
      setItems(parsed.items);
      setDiscount(parsed.discount);
      setCouponCode(parsed.couponCode);
    }

    async function loadCartFromBackend() {
      try {
        const headers = await buildUserHeaders();
        const res = await fetch("/api/user/cart", { headers });
        const data = (await res.json()) as
          | { success?: boolean; cart?: CartPayload; items?: CartLine[]; discount?: number; couponCode?: string }
          | { error?: string };
        if (!res.ok) return;
        const nextItems =
          "cart" in data && data.cart ? (data.cart.items ?? []) : "items" in data ? (data.items ?? []) : [];
        setItems(nextItems);
        setDiscount(0);
        setCouponCode("");
      } finally {
        setReadyToSync(true);
      }
    }
    void loadCartFromBackend();
  }, []);

  useEffect(() => {
    setReadyToSync(false);
    const unsubscribe = onAuthStateChanged(auth, async () => {
      try {
        setReadyToSync(false);
        const headers = await buildUserHeaders();
        const res = await fetch("/api/user/cart", { headers });
        const data = (await res.json()) as
          | { success?: boolean; cart?: CartPayload; items?: CartLine[]; discount?: number; couponCode?: string }
          | { error?: string };
        if (!res.ok) return;
        const nextItems =
          "cart" in data && data.cart ? (data.cart.items ?? []) : "items" in data ? (data.items ?? []) : [];
        setItems(nextItems);
        setDiscount(0);
        setCouponCode("");
      } finally {
        setReadyToSync(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    persistCart({ items, discount, couponCode });
  }, [couponCode, discount, items]);

  useEffect(() => {
    if (!readyToSync) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const headers = await buildUserHeaders({ "Content-Type": "application/json" });
        await fetch("/api/user/cart", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ items })
        });
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [items, readyToSync]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousTouchAction = body.style.touchAction;
    const previousRootOverflow = root.style.overflow;
    const previousScrollBehavior = root.style.scrollBehavior;

    if (isOpen) {
      const scrollY = window.scrollY;
      body.dataset.cartScrollY = String(scrollY);
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      body.style.touchAction = "none";
      root.style.overflow = "hidden";
      root.style.scrollBehavior = "auto";
    }

    return () => {
      const savedScrollY = Number(body.dataset.cartScrollY ?? 0);
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.touchAction = previousTouchAction;
      root.style.overflow = previousRootOverflow;
      root.style.scrollBehavior = previousScrollBehavior;
      if (isOpen) {
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [isOpen]);

  const itemQty = useCallback((productId: string) => getItemQuantity(items, productId), [items]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = computeSubtotal(items);
    const count = computeLineItemCount(items);
    const total = computeTotalAfterDiscount(subtotal, discount);
    return {
      items,
      isOpen,
      subtotal,
      count,
      discount,
      couponCode,
      total,
      itemQty,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQty,
      applyCoupon,
      clearCoupon,
      clearCart
    };
  }, [
    addItem,
    applyCoupon,
    clearCart,
    clearCoupon,
    closeCart,
    couponCode,
    discount,
    isOpen,
    itemQty,
    items,
    openCart,
    removeItem,
    updateQty
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
