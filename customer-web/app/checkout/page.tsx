"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Clock, CreditCard, Loader2, Tag } from "lucide-react";
import { CheckoutAddressSection } from "@/components/checkout/checkout-address-section";
import { useCart } from "@/components/cart/cart-provider";
import { useAuth, type OpenAuthModalOptions } from "@/context/auth-context";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useToast } from "@/components/providers/toast-provider";
import { formatDeliveryAddressForOrder, toSerializedDeliveryAddress } from "@/lib/delivery-address-types";
import { ORDER_SUCCESS_STORAGE_KEY, type OrderSuccessSnapshot } from "@/lib/order-success-storage";
import {
  createRazorpayPaymentOrder,
  loadRazorpayScript,
  openRazorpayCheckout,
  shouldFallbackRazorpayToCod,
  type CreatePaymentOrderResult
} from "@/lib/payment-service";
import { buildUserHeaders } from "@/lib/user-session";
import { estimateCheckoutDisplay } from "@/lib/delivery-eta";
import { getDefaultRestaurantLocation } from "@/lib/restaurant-location";
import { resolveMenuImageSrc } from "@/lib/image-url";
import { normalizeIndiaMobileForRazorpay } from "@/lib/razorpay-checkout";
import { auth } from "@/lib/firebase";

type PaymentMethod = "cod" | "razorpay";

const CHECKOUT_AUTH_MODAL: OpenAuthModalOptions = {
  fullPageLoginHref: `/login?redirect=${encodeURIComponent("/checkout")}`,
  modalTitle: "Login Required",
  modalDescription: "Please log in to continue checkout. You can use phone OTP, email, or Google and return here after signing in."
};

type CreateOrderResponse = {
  success: boolean;
  message?: string;
  orderId?: string;
  totalAmount?: number;
  trackingToken?: string;
  error?: string;
};

function parseJsonSafe<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, discount, couponCode, deliveryFee, grandTotal, clearCart, applyCoupon, clearCoupon } =
    useCart();
  const {
    addresses,
    selectedAddress,
    selectedId,
    selectAddress,
    loading: addressLoading
  } = useDeliveryAddress();
  const { showToast } = useToast();
  const { user, authReady, login, closeAuthModal } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  /** Server-aligned total (INR) when /api/create-order reports a drift vs client `grandTotal`. */
  const [alignedCheckoutTotal, setAlignedCheckoutTotal] = useState<number | null>(null);

  const payableTotal = alignedCheckoutTotal ?? grandTotal;

  /**
   * Guest: no `currentUser` while auth is still wiring → show login immediately (no long “Checking session…”).
   * Returning user: `currentUser` set from persistence before `authReady` → brief “Restoring session…” only then.
   */
  const sessionRestoring = !authReady && auth.currentUser != null;
  const guestCheckoutBlocked = !authReady && auth.currentUser == null;

  /** Prefetch Razorpay script after login so the modal opens faster; never runs for guests. */
  useEffect(() => {
    if (!user || items.length === 0) return;
    if (paymentMethod !== "razorpay") return;
    void loadRazorpayScript();
  }, [user, items.length, paymentMethod]);

  useEffect(() => {
    setAlignedCheckoutTotal(null);
  }, [items, couponCode, subtotal, discount, deliveryFee]);

  /** Auto-select when only one saved address exists (fast checkout). */
  useEffect(() => {
    if (!user || addressLoading || addresses.length !== 1) return;
    if (!selectedId || !addresses.some((a) => a.id === selectedId)) {
      selectAddress(addresses[0].id);
    }
  }, [user, addressLoading, addresses, selectedId, selectAddress]);

  useEffect(() => {
    if (!user || !couponCode.trim() || items.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: couponCode, subtotal })
        });
        const data = (await res.json()) as { valid?: boolean; discount?: number; message?: string };
        if (cancelled) return;
        if (res.ok && data.valid && typeof data.discount === "number") {
          applyCoupon(couponCode, data.discount);
        } else {
          clearCoupon();
          showToast({
            type: "error",
            title: "Coupon removed",
            description: data.message ?? "This coupon no longer applies to your order."
          });
        }
      } catch {
        /* ignore network errors during background revalidation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subtotal, couponCode, items.length, applyCoupon, clearCoupon, showToast]);

  const checkoutEta = useMemo(() => {
    if (items.length === 0 || !selectedAddress) return null;
    const totalQty = items.reduce((sum, line) => sum + line.quantity, 0);
    const lat =
      typeof selectedAddress.lat === "number" && Number.isFinite(selectedAddress.lat)
        ? selectedAddress.lat
        : undefined;
    const lng =
      typeof selectedAddress.lng === "number" && Number.isFinite(selectedAddress.lng)
        ? selectedAddress.lng
        : undefined;
    return estimateCheckoutDisplay({
      restaurant: getDefaultRestaurantLocation(),
      deliveryLatLng: lat !== undefined && lng !== undefined ? { lat, lng } : null,
      lineCount: items.length,
      totalQuantity: totalQty
    });
  }, [items, selectedAddress]);

  async function applyCheckoutCoupon() {
    setCouponError("");
    const raw = couponInput.trim();
    if (!raw) return;
    setCouponApplying(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw, subtotal })
      });
      const data = (await res.json()) as { valid?: boolean; discount?: number; message?: string };
      if (!res.ok || !data.valid || typeof data.discount !== "number") {
        setCouponError(data.message ?? "Invalid coupon code.");
        showToast({
          type: "error",
          title: "Coupon not applied",
          description: data.message ?? "Check the code and minimum order amount."
        });
        return;
      }
      applyCoupon(raw, data.discount);
      setCouponInput("");
      showToast({
        title: "Coupon applied",
        description: `${raw.toUpperCase()} — Rs. ${data.discount} off`
      });
    } catch {
      setCouponError("Unable to validate coupon right now.");
      showToast({ type: "error", title: "Coupon error", description: "Try again in a moment." });
    } finally {
      setCouponApplying(false);
    }
  }

  function buildOrderPayload() {
    if (!selectedAddress) return null;
    const deliveryAddress = toSerializedDeliveryAddress(selectedAddress);
    return {
      customerName: selectedAddress.name.trim(),
      phone: selectedAddress.phone.trim(),
      items: items.map((item) => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      address: formatDeliveryAddressForOrder(selectedAddress),
      deliveryAddress,
      couponCode: couponCode || undefined,
      orderType: "delivery" as const
    };
  }

  async function placeCodOrder(
    base: NonNullable<ReturnType<typeof buildOrderPayload>>
  ): Promise<CreateOrderResponse> {
    const headers = await buildUserHeaders({ "Content-Type": "application/json" });
    const res = await fetch("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...base, paymentMethod: "cod" as const })
    });
    const text = await res.text();
    const data = parseJsonSafe<CreateOrderResponse>(text);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error ?? "Could not place order.");
    }
    return data;
  }

  async function finalizeSuccess(data: CreateOrderResponse) {
    if (!data.orderId || typeof data.totalAmount !== "number") {
      throw new Error(data.error ?? "Could not place order.");
    }
    const snapshot: OrderSuccessSnapshot = {
      orderId: data.orderId,
      totalAmount: data.totalAmount,
      ...(typeof data.trackingToken === "string" && data.trackingToken ? { trackingToken: data.trackingToken } : {}),
      message: data.message,
      placedAt: new Date().toISOString(),
      items: items.map((item) => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        lineTotal: item.price * item.quantity
      }))
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem(ORDER_SUCCESS_STORAGE_KEY, JSON.stringify(snapshot));
    }

    clearCart({ silent: true });
    showToast({
      title: "Order placed successfully",
      description: `Order #${data.orderId}`
    });

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    startTransition(() => {
      router.replace("/order-success");
    });
  }

  async function placeOrder() {
    if (submitting) return;
    if (!user) {
      login(CHECKOUT_AUTH_MODAL);
      return;
    }
    setSubmitting(true);
    setMessage("");

    try {
      if (items.length === 0) {
        throw new Error("Your cart is empty.");
      }

      if (!selectedAddress) {
        throw new Error("Choose a delivery address to continue.");
      }

      const base = buildOrderPayload();
      if (!base) {
        throw new Error("Choose a delivery address to continue.");
      }

      if (paymentMethod === "cod") {
        const data = await placeCodOrder(base);
        await finalizeSuccess(data);
        return;
      }

      if (!normalizeIndiaMobileForRazorpay(base.phone)) {
        throw new Error(
          "Add a valid 10-digit Indian mobile on your delivery address (starts with 6–9) for UPI / online payment."
        );
      }

      const headers = await buildUserHeaders({ "Content-Type": "application/json" });
      let created: CreatePaymentOrderResult = await createRazorpayPaymentOrder(
        { ...base, amount: payableTotal },
        headers
      );

      if (!created.ok && "priceUpdated" in created && created.priceUpdated) {
        showToast({
          type: "warning",
          title: "Price updated",
          description: `${created.message} — new total Rs. ${created.correctTotal}`
        });
        setAlignedCheckoutTotal(created.correctTotal);
        created = await createRazorpayPaymentOrder({ ...base, amount: created.correctTotal }, headers);
      }

      if (!created.ok) {
        if (shouldFallbackRazorpayToCod(created)) {
          showToast({
            type: "warning",
            title: "Online payment unavailable",
            description: "Placing your order with cash on delivery instead."
          });
          setPaymentMethod("cod");
          const data = await placeCodOrder(base);
          await finalizeSuccess(data);
          return;
        }
        throw new Error(
          !created.ok && "error" in created ? created.error : "Could not start online payment."
        );
      }

      if (
        !created.razorpayOrderId?.trim() ||
        !Number.isFinite(created.amount) ||
        created.amount < 100 ||
        !created.keyId?.trim()
      ) {
        throw new Error("Payment order was not created correctly. Try again or use cash on delivery.");
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[checkout] Razorpay create-order ok", {
          orderId: created.razorpayOrderId,
          amountPaise: created.amount,
          deliveryPhone: base.phone
        });
      }

      setSubmitting(false);

      const opened = await openRazorpayCheckout({
        keyId: created.keyId,
        amountPaise: created.amount,
        currency: created.currency,
        orderId: created.razorpayOrderId,
        businessName: "Nausheen Fruits",
        description: "Order payment",
        customerName: base.customerName,
        customerPhone: base.phone,
        customerEmail: user.email,
        onSuccess: async (rz) => {
          setSubmitting(true);
          setMessage("");
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: await buildUserHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({
                razorpay_order_id: rz.razorpay_order_id,
                razorpay_payment_id: rz.razorpay_payment_id,
                razorpay_signature: rz.razorpay_signature,
                ...base
              })
            });
            const verifyText = await verifyRes.text();
            const verifyJson = parseJsonSafe<CreateOrderResponse>(verifyText);
            if (!verifyRes.ok || !verifyJson?.success) {
              throw new Error(verifyJson?.error ?? "Payment verification failed.");
            }
            await finalizeSuccess(verifyJson);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Payment verification failed.";
            setMessage(msg);
            showToast({ title: "Payment failed", description: msg, type: "error" });
          } finally {
            setSubmitting(false);
          }
        },
        onDismiss: () => {
          showToast({
            type: "warning",
            title: "Payment window closed",
            description: "You can try again or choose cash on delivery."
          });
        }
      });

      if (!opened) {
        throw new Error("Could not load Razorpay checkout. Check your connection or try cash on delivery.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Order failed.");
      showToast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Could not place order",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }
  if (items.length === 0) {
    return (
      <section className="relative z-[1] mx-auto max-w-lg space-y-4 px-5 pb-12 pt-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Checkout</h1>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="font-medium text-slate-800 dark:text-slate-100">Your cart is empty</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add items from the menu to place an order.</p>
          <Link
            href="/menu"
            className="mt-6 inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Browse menu
          </Link>
        </div>
      </section>
    );
  }

  if (sessionRestoring) {
    return (
      <section
        className="relative z-[1] mx-auto flex max-w-lg min-h-[40vh] flex-col items-center justify-center gap-3 px-5 pb-12 pt-8 text-center"
        aria-busy="true"
        aria-label="Restoring session"
      >
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">Restoring your session…</p>
      </section>
    );
  }

  if (!user || guestCheckoutBlocked) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-login-title">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
          <h1 id="checkout-login-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Login Required
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Please log in to continue checkout.</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            {items.length} item{items.length === 1 ? "" : "s"} in your cart · Rs. {grandTotal} total
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
            <button
              type="button"
              onClick={() => login(CHECKOUT_AUTH_MODAL)}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 sm:w-auto sm:min-w-[120px]"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                closeAuthModal();
                router.push("/cart");
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:w-auto sm:min-w-[120px]"
            >
              Cancel
            </button>
          </div>
          <Link
            href={CHECKOUT_AUTH_MODAL.fullPageLoginHref ?? "/login"}
            className="mt-4 block text-center text-sm font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
          >
            Open full login page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="relative z-[1] mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden px-5 pb-28 pt-2 sm:space-y-6 sm:pb-12 md:pb-12">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl md:text-3xl lg:text-4xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 md:text-base">Review your order and confirm delivery details.</p>
      </div>

      <CheckoutAddressSection sectionId="checkout-delivery" />

      {selectedAddress && checkoutEta ? (
        <div className="flex items-start gap-2 rounded-2xl border border-teal-200/80 bg-teal-50/90 px-4 py-3 text-sm text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/35 dark:text-teal-100">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <div>
            <p className="font-semibold">{checkoutEta.phrase}</p>
            <p className="mt-0.5 text-xs text-teal-800/90 dark:text-teal-200/90">
              Smart ETA
              {checkoutEta.distanceKm != null ? ` · ${checkoutEta.distanceKm.toFixed(1)} km` : ""} · prep & traffic
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <aside className="order-1 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-md transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 sm:p-4 lg:order-2 lg:p-5 hover:shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order summary</h2>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Promo code
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter code"
                maxLength={40}
                disabled={couponApplying}
                className="min-w-0 w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:text-base dark:border-slate-600 dark:bg-slate-900"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyCheckoutCoupon();
                  }
                }}
              />
              <button
                type="button"
                disabled={couponApplying || !couponInput.trim()}
                onClick={() => void applyCheckoutCoupon()}
                className="w-full shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 sm:w-auto"
              >
                {couponApplying ? "…" : "Apply"}
              </button>
            </div>
            {couponCode ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/35">
                <span className="text-emerald-900 dark:text-emerald-100">
                  <span className="font-semibold">{couponCode}</span>
                  <span className="text-emerald-700 dark:text-emerald-300"> — Rs. {discount} off</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearCoupon();
                    setCouponError("");
                    showToast({ title: "Coupon removed" });
                  }}
                  className="shrink-0 font-medium text-red-600 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            ) : null}
            {couponError ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{couponError}</p> : null}
          </div>

          <ul className="max-h-[min(40vh,320px)] space-y-3 overflow-y-auto pr-1">
            {(items ?? []).map((item) => (
              <li key={item.productId} className="flex gap-3 text-sm">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img
                    src={resolveMenuImageSrc(item.image)}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-slate-900 dark:text-slate-50">{item.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Rs. {item.price} × {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  Rs. {item.price * item.quantity}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="tabular-nums">Rs. {subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{couponCode ? `Discount (${couponCode})` : "Discount"}</span>
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">-Rs. {discount}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Delivery</span>
              <span className="tabular-nums">Rs. {deliveryFee}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <span>Total (est.)</span>
              <span className="tabular-nums">Rs. {payableTotal}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              Final total is confirmed on the server (tax + delivery). You&apos;ll see the exact amount after placing the order.
            </p>
          </div>
        </aside>

        <div className="order-2 space-y-5 lg:order-1">
          {message ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              <p>{message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setMessage("");
                    void placeOrder();
                  }}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-500"
                >
                  {paymentMethod === "razorpay" ? "Retry payment" : "Try again"}
                </button>
                {paymentMethod === "razorpay" ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setMessage("");
                      setPaymentMethod("cod");
                      showToast({
                        title: "Cash on delivery",
                        description: "Place the order again — you’ll pay when it arrives."
                      });
                    }}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-100 dark:hover:bg-slate-800"
                  >
                    Use cash on delivery instead
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setMessage("")}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Delivery contact</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Name and phone are taken from the address you selected in the delivery section.
            </p>
          </div>

          <div
            id="checkout-payment"
            className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Payment</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose cash on delivery or pay online with Razorpay. Online payments are verified before your order is
              created.
            </p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Payment method">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                  paymentMethod === "cod"
                    ? "border-orange-400 bg-orange-50/80 dark:border-orange-700 dark:bg-orange-950/30"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-0.5"
                />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Banknote className="h-5 w-5 text-slate-700 dark:text-slate-200" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Cash on delivery (COD)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pay the rider when you receive your order.</p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                  paymentMethod === "razorpay"
                    ? "border-orange-400 bg-orange-50/80 dark:border-orange-700 dark:bg-orange-950/30"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "razorpay"}
                  onChange={() => setPaymentMethod("razorpay")}
                  className="mt-0.5"
                />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <CreditCard className="h-5 w-5 text-slate-700 dark:text-slate-200" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Razorpay (UPI / card / netbanking)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pay securely now. Order is saved after payment succeeds.</p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void placeOrder()}
            disabled={submitting || items.length === 0 || !selectedAddress}
            aria-busy={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60 dark:bg-orange-500 dark:hover:bg-orange-400 md:w-auto md:min-w-[200px] md:self-start"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Placing order…
              </>
            ) : paymentMethod === "razorpay" ? (
              "Pay with Razorpay"
            ) : (
              "Place order"
            )}
          </button>
        </div>
      </div>

      {user && items.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden">
          <div className="pointer-events-auto border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
            {selectedAddress ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                    Delivering to
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{selectedAddress.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {selectedAddress.addressLine.length > 48
                      ? `${selectedAddress.addressLine.slice(0, 48)}…`
                      : selectedAddress.addressLine}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("checkout-delivery")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  Change
                </button>
              </div>
            ) : (
              <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                Select a delivery address above
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
