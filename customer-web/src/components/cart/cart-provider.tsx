"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { Product } from "@/lib/menu-data-types";
import { useToast } from "@/components/providers/toast-provider";
import { buildUserHeaders } from "@/lib/user-session";
import {
  type CartLine,
  type CartPayload,
  CART_STORAGE_KEY,
  computeDeliveryFee,
  computeGrandTotal,
  computeLineItemCount,
  computeSubtotal,
  computeTotalAfterDiscount,
  getItemQuantity,
  loadPersistedCart,
  normalizeCartLine,
  persistCart
} from "@/lib/cart";
import { auth } from "@/lib/firebase";

export type CartContextValue = {
  items: CartLine[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  discount: number;
  couponCode: string;
  /** Subtotal minus discount (no delivery). */
  total: number;
  deliveryFee: number;
  /** Discounted subtotal + delivery. */
  grandTotal: number;
  itemQty: (productId: string) => number;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  applyCoupon: (code: string, discountAmount: number) => void;
  clearCoupon: () => void;
  clearCart: (options?: { silent?: boolean }) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function normalizeItemsList(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCartLine).filter((line): line is CartLine => Boolean(line));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [readyToSync, setReadyToSync] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pendingToastRef = useRef<{ title: string; description?: string } | null>(null);
  const hydratedLocalRef = useRef(false);
  const fetchedServerCartRef = useRef<string | null>(null);
  const { showToast } = useToast();

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (product: Product) => {
      setItems((prev) => {
        const exists = prev.find((item) => item.productId === product.id);
        if (exists) {
          pendingToastRef.current = {
            title: "Updated cart",
            description: `${product.name} quantity increased`
          };
          return prev.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        pendingToastRef.current = {
          title: "Added to cart",
          description: `${product.name} is now in your cart`
        };
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image ?? "",
            quantity: 1
          }
        ];
      });
    },
    []
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItems((prev) => {
        const item = prev.find((entry) => entry.productId === productId);
        if (item) {
          pendingToastRef.current = {
            title: "Removed from cart",
            description: item.name
          };
        }
        return prev.filter((entry) => entry.productId !== productId);
      });
    },
    []
  );

  const updateQty = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0)
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

  const clearCart = useCallback(
    (options?: { silent?: boolean }) => {
      setItems([]);
      setCouponCode("");
      setDiscount(0);
      if (authUid) {
        void (async () => {
          try {
            const headers = await buildUserHeaders({ "Content-Type": "application/json" });
            await fetch("/api/user/cart", {
              method: "PATCH",
              headers,
              body: JSON.stringify({ items: [] })
            });
          } catch {
            /* Best-effort; debounced sync also persists [] when the session is active */
          }
        })();
      }
      if (!options?.silent) {
        showToast({
          title: "Cart cleared",
          description: "Your cart is now empty"
        });
      }
    },
    [showToast, authUid]
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    const payload = pendingToastRef.current;
    if (!payload) return;
    showToast(payload);
    pendingToastRef.current = null;
  }, [items, showToast]);

  useEffect(() => {
    if (hydratedLocalRef.current) return;
    hydratedLocalRef.current = true;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(CART_STORAGE_KEY) : null;
    const parsed = loadPersistedCart(raw);
    if (parsed) {
      setItems(parsed.items);
      setDiscount(parsed.discount);
      setCouponCode(parsed.couponCode);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!authUid) {
      fetchedServerCartRef.current = null;
      setReadyToSync(true);
      return;
    }
    if (fetchedServerCartRef.current === authUid) {
      setReadyToSync(true);
      return;
    }

    let cancelled = false;
    setReadyToSync(false);
    void (async () => {
      try {
        const headers = await buildUserHeaders();
        const res = await fetch("/api/user/cart", { headers });
        const data = (await res.json()) as
          | { success?: boolean; cart?: CartPayload; items?: unknown[]; discount?: number; couponCode?: string }
          | { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setReadyToSync(true);
          return;
        }
        const rawItems =
          "cart" in data && data.cart ? data.cart.items : "items" in data ? data.items : [];
        const nextItems = normalizeItemsList(rawItems);
        setItems(nextItems);
        setDiscount(0);
        setCouponCode("");
        fetchedServerCartRef.current = authUid;
      } finally {
        if (!cancelled) setReadyToSync(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUid]);

  useEffect(() => {
    persistCart({ items, discount, couponCode });
  }, [couponCode, discount, items]);

  useEffect(() => {
    if (!readyToSync || !authUid) return;
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
  }, [items, readyToSync, authUid]);

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
    const deliveryFee = computeDeliveryFee(items);
    const grandTotal = computeGrandTotal(items, discount);
    return {
      items,
      isOpen,
      subtotal,
      count,
      discount,
      couponCode,
      total,
      deliveryFee,
      grandTotal,
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
