"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { useToast } from "@/components/providers/toast-provider";

const PLACEHOLDER_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800";

export function CartDrawer() {
  const {
    isOpen,
    closeCart,
    items,
    subtotal,
    discount,
    couponCode,
    total,
    updateQty,
    removeItem,
    applyCoupon,
    clearCoupon
  } = useCart();
  const deliveryFee = subtotal > 0 ? 40 : 0;
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCart();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeCart]);

  async function validateCoupon() {
    setCouponError("");
    if (!couponInput.trim()) return;
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), subtotal })
      });
      const text = await res.text();
      let data: { valid?: boolean; discount?: number; message?: string } | null = null;
      if (text) {
        try {
          data = JSON.parse(text) as { valid?: boolean; discount?: number; message?: string };
        } catch {
          data = null;
        }
      }
      if (!res.ok || !data?.valid || typeof data.discount !== "number") {
        setCouponError(data?.message ?? "Coupon invalid");
        showToast({
          title: "Coupon not applied",
          description: data?.message ?? "Invalid coupon code",
          type: "error"
        });
        return;
      }
      applyCoupon(couponInput.trim(), data.discount);
      showToast({
        title: "Coupon applied",
        description: `${couponInput.trim().toUpperCase()} saved Rs. ${data.discount}`
      });
      setCouponInput("");
    } catch {
      setCouponError("Unable to validate coupon right now.");
      showToast({
        title: "Coupon not applied",
        description: "Unable to validate coupon right now.",
        type: "error"
      });
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            aria-label="Close cart drawer overlay"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />
          <motion.aside
            role="dialog"
            aria-label="Cart Drawer"
            className="fixed right-0 top-0 z-50 h-[100dvh] w-full max-w-md bg-white shadow-2xl will-change-transform dark:bg-slate-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.6 }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-4 dark:border-slate-800">
                <h2 className="text-lg font-semibold">Your Cart</h2>
                <button onClick={closeCart} aria-label="Close cart drawer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-auto p-4">
                {items.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      Your cart is empty
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-300">
                      Add something tasty from the menu to get started.
                    </p>
                    <Link
                      href="/menu"
                      onClick={closeCart}
                      className="mt-1 inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.97] dark:bg-orange-500 dark:hover:bg-orange-400"
                    >
                      Browse menu
                    </Link>
                  </div>
                )}
                {items.map((item) => {
                  const imageSrc = item.image && item.image.trim().length > 0 ? item.image : PLACEHOLDER_IMAGE;
                  const lineTotal = item.price * item.qty;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={imageSrc}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                              Rs. {item.price} each
                            </p>
                          </div>
                          <button
                            aria-label="Remove item"
                            onClick={() => removeItem(item.id)}
                            className="rounded-full p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                            <button
                              aria-label="Decrease quantity"
                              onClick={() => updateQty(item.id, item.qty - 1)}
                              className="rounded-full p-1 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-6 text-center text-sm font-semibold tabular-nums">
                              {item.qty}
                            </span>
                            <button
                              aria-label="Increase quantity"
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              className="rounded-full p-1 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                            Rs. {lineTotal}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3 border-t p-4 dark:border-slate-800">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Coupon code"
                      className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button onClick={validateCoupon} className="rounded-lg border px-3 py-2 text-sm font-medium dark:border-slate-700">
                      Apply
                    </button>
                  </div>
                  {couponCode && (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/30">
                      <span>
                        Applied: <strong>{couponCode}</strong> (-Rs. {discount})
                      </span>
                      <button onClick={clearCoupon} className="font-medium text-red-600">
                        Remove
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>Rs. {subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount</span>
                  <span>-Rs. {discount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>Rs. {deliveryFee}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>Rs. {total + deliveryFee}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">Estimated delivery: 25-35 mins</p>
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="block rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] dark:bg-orange-500 dark:hover:bg-orange-400"
                >
                  Proceed to Checkout
                </Link>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
