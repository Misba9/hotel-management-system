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
import type { Product } from "@/src/lib/menu-data-types";
import { auth } from "@/src/lib/firebase";
import { apiFetch } from "@/src/lib/api";
import { buildUserHeaders } from "@/src/lib/user-session";
import {
  type CartLine,
  type CartPayload,
  computeDeliveryFee,
  computeGrandTotal,
  computeLineItemCount,
  computeSubtotal,
  computeTotalAfterDiscount,
  getItemQuantity,
  loadCartFromStorage,
  normalizeCartLine,
  persistCart
} from "@/src/lib/cart";
import { resolveMenuImageSrc } from "@/src/lib/image-url";

export type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  discount: number;
  couponCode: string;
  total: number;
  deliveryFee: number;
  grandTotal: number;
  itemQty: (productId: string) => number;
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
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [readyToSync, setReadyToSync] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const hydratedLocalRef = useRef(false);
  const fetchedServerCartRef = useRef<string | null>(null);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const exists = prev.find((item) => item.productId === product.id);
      if (exists) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          image: resolveMenuImageSrc(product.image),
          quantity: 1
        }
      ];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((entry) => entry.productId !== productId));
  }, []);

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
            await apiFetch("/api/user/cart", {
              method: "PATCH",
              headers,
              body: JSON.stringify({ items: [] })
            });
          } catch {
            /* best effort */
          }
        })();
      }
      void options;
    },
    [authUid]
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (hydratedLocalRef.current) return;
    hydratedLocalRef.current = true;
    void (async () => {
      const parsed = await loadCartFromStorage();
      if (parsed) {
        setItems(parsed.items);
        setDiscount(parsed.discount);
        setCouponCode(parsed.couponCode);
      }
    })();
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
        const res = await apiFetch("/api/user/cart", { headers });
        const data = (await res.json()) as
          | { success?: boolean; cart?: CartPayload; items?: unknown[] }
          | { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setReadyToSync(true);
          return;
        }
        const rawItems =
          "cart" in data && data.cart ? data.cart.items : "items" in data ? data.items : [];
        setItems(normalizeItemsList(rawItems));
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
    void persistCart({ items, discount, couponCode });
  }, [couponCode, discount, items]);

  useEffect(() => {
    if (!readyToSync || !authUid) return;
    const timer = setTimeout(() => {
      void (async () => {
        const headers = await buildUserHeaders({ "Content-Type": "application/json" });
        await apiFetch("/api/user/cart", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ items })
        });
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [items, readyToSync, authUid]);

  const itemQty = useCallback((productId: string) => getItemQuantity(items, productId), [items]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = computeSubtotal(items);
    const count = computeLineItemCount(items);
    const total = computeTotalAfterDiscount(subtotal, discount);
    const deliveryFee = computeDeliveryFee(items);
    const grandTotal = computeGrandTotal(items, discount);
    return {
      items,
      count,
      subtotal,
      discount,
      couponCode,
      total,
      deliveryFee,
      grandTotal,
      itemQty,
      addItem,
      removeItem,
      updateQty,
      applyCoupon,
      clearCoupon,
      clearCart
    };
  }, [addItem, applyCoupon, clearCart, clearCoupon, couponCode, discount, itemQty, items, removeItem, updateQty]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
