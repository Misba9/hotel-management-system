"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Product } from "@/lib/menu-data";
import { useToast } from "@/components/providers/toast-provider";
import { buildAuthHeaders } from "@/lib/user-session";

type CartItem = Pick<Product, "id" | "name" | "price" | "image"> & { qty: number };
type CartPayload = {
  userId?: string;
  items?: CartItem[];
  updatedAt?: string;
};

type CartContextValue = {
  items: CartItem[];
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
const KEY = "nausheen_cart_cache";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
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
        return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 }];
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
  const updateQty = useCallback(
    (productId: string, qty: number) =>
      setItems((prev) =>
        prev
          .map((item) => (item.id === productId ? { ...item, qty } : item))
          .filter((item) => item.qty > 0)
      ),
    []
  );
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
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as { items?: CartItem[]; discount?: number; couponCode?: string };
        setItems(cached.items ?? []);
        setDiscount(Number(cached.discount ?? 0));
        setCouponCode(String(cached.couponCode ?? ""));
      } catch {
        window.localStorage.removeItem(KEY);
      }
    }
    async function loadCartFromBackend() {
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/user/cart", { headers });
        const data = (await res.json()) as
          | { success?: boolean; cart?: CartPayload; items?: CartItem[]; discount?: number; couponCode?: string }
          | { error?: string };
        if (!res.ok) return;
        const items = "cart" in data && data.cart ? data.cart.items ?? [] : "items" in data ? data.items ?? [] : [];
        setItems(items);
        setDiscount(0);
        setCouponCode("");
      } finally {
        setReadyToSync(true);
      }
    }
    void loadCartFromBackend();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        items,
        discount,
        couponCode
      })
    );
  }, [couponCode, discount, items]);

  useEffect(() => {
    if (!readyToSync) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
        await fetch("/api/user/cart", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            items
          })
        });
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [couponCode, discount, items, readyToSync]);

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

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const total = Math.max(subtotal - discount, 0);
    return {
      items,
      isOpen,
      subtotal,
      count,
      discount,
      couponCode,
      total,
      itemQty: (productId) => items.find((item) => item.id === productId)?.qty ?? 0,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQty,
      applyCoupon,
      clearCoupon,
      clearCart
    };
  }, [addItem, applyCoupon, clearCart, clearCoupon, closeCart, couponCode, discount, isOpen, items, openCart, removeItem, updateQty]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
