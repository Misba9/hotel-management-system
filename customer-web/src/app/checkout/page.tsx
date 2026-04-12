"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Loader2, MapPin, Tag } from "lucide-react";
import { CheckoutAddressModal } from "@/components/checkout/checkout-address-modal";
import { useCart } from "@/components/cart/cart-provider";
import { useAuth, type OpenAuthModalOptions } from "@/context/auth-context";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useToast } from "@/components/providers/toast-provider";
import { formatDeliveryAddressForOrder } from "@/lib/delivery-address-types";
import { ORDER_SUCCESS_STORAGE_KEY, type OrderSuccessSnapshot } from "@/lib/order-success-storage";
import { createRazorpayPaymentOrder, openRazorpayCheckout } from "@/lib/payment-service";
import { buildUserHeaders } from "@/lib/user-session";

type PaymentMethod = "cod" | "razorpay";

const CHECKOUT_AUTH_MODAL: OpenAuthModalOptions = {
  fullPageLoginHref: `/login?redirect=${encodeURIComponent("/checkout")}`,
  modalTitle: "Please sign in to continue",
  modalDescription: "Use phone OTP, email/password, or Google. You stay on this page and continue checkout after login."
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
  const { selectedAddress, loading: addressLoading } = useDeliveryAddress();
  const { showToast } = useToast();
  const { user, authReady, login } = useAuth();
  const authPromptedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);

  useEffect(() => {
    if (!authReady || user || items.length === 0) return;
    if (authPromptedRef.current) return;
    authPromptedRef.current = true;
    login(CHECKOUT_AUTH_MODAL);
  }, [authReady, user, items.length, login]);

  useEffect(() => {
    if (user) authPromptedRef.current = false;
  }, [user]);

  useEffect(() => {
    if (items.length === 0 || addressLoading) return;
    if (!selectedAddress) setAddressModalOpen(true);
  }, [items.length, selectedAddress, addressLoading]);

  useEffect(() => {
    if (!couponCode.trim() || items.length === 0) return;
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
  }, [subtotal, couponCode, items.length, applyCoupon, clearCoupon, showToast]);

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
      couponCode: couponCode || undefined,
      orderType: "delivery" as const
    };
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
    router.replace("/order-success");
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
        setAddressModalOpen(true);
        throw new Error("Choose a delivery address to continue.");
      }

      const base = buildOrderPayload();
      if (!base) {
        throw new Error("Choose a delivery address to continue.");
      }

      if (paymentMethod === "cod") {
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

        await finalizeSuccess(data);
        return;
      }

      const headers = await buildUserHeaders({ "Content-Type": "application/json" });
      const created = await createRazorpayPaymentOrder({ ...base, amount: grandTotal }, headers);
      if (!created.ok) {
        throw new Error(created.error);
      }

      setSubmitting(false);

      const opened = await openRazorpayCheckout({
        keyId: created.keyId,
        amountPaise: created.amount,
        currency: created.currency,
        orderId: created.razorpayOrderId,
        customerName: base.customerName,
        customerPhone: base.phone,
        customerEmail: user.email,
        onSuccess: async (rz) => {
          setSubmitting(true);
          setMessage("");
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: await buildUserHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({
                razorpay_order_id: rz.razorpay_order_id,
                razorpay_payment_id: rz.razorpay_payment_id,
                razorpay_signature: rz.razorpay_signature,
                ...base
              })
            });
            const verifyJson = parseJsonSafe<CreateOrderResponse>(await verifyRes.text());
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
            type: "error",
            title: "Payment cancelled",
            description: "You can try again or choose cash on delivery."
          });
        }
      });

      if (!opened) {
        throw new Error("Could not load Razorpay checkout. Check your connection or try again.");
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

  const requireAddressLock = items.length > 0 && !selectedAddress;

  if (!authReady) {
    return (
      <section className="mx-auto flex max-w-lg min-h-[40vh] flex-col items-center justify-center gap-3 pb-12 pt-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking your session…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-lg space-y-4 pb-12 pt-2 text-center">
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

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden pb-24 pt-2 sm:space-y-6 md:pb-12">
      <CheckoutAddressModal
        open={addressModalOpen}
        onOpenChange={setAddressModalOpen}
        requireSelection={requireAddressLock}
      />

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl md:text-3xl lg:text-4xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 md:text-base">Review your order and confirm delivery details.</p>
      </div>

      {!user ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-orange-50/80 p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/25 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Sign in with your phone to place this order. You can close this reminder and sign in when you&apos;re ready.
          </p>
          <button
            type="button"
            onClick={() => login(CHECKOUT_AUTH_MODAL)}
            className="w-full shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg sm:w-auto"
          >
            Sign in
          </button>
        </div>
      ) : null}

      {selectedAddress ? (
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-4 shadow-sm dark:border-orange-900/40 dark:from-orange-950/40 dark:to-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-200">
                  Deliver to
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-50">{selectedAddress.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{selectedAddress.phone}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {selectedAddress.addressLine}
                  {selectedAddress.city ? (
                    <>
                      <br />
                      <span>{selectedAddress.city}</span>
                    </>
                  ) : null}
                  {selectedAddress.landmark ? (
                    <>
                      <br />
                      <span className="text-slate-500 dark:text-slate-400">Near {selectedAddress.landmark}</span>
                    </>
                  ) : null}
                  <br />
                  <span className="font-medium tabular-nums">{selectedAddress.pincode}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="shrink-0 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 shadow-sm transition hover:bg-orange-50 dark:border-orange-800 dark:bg-slate-900 dark:text-orange-300 dark:hover:bg-orange-950/50"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 dark:border-slate-600 dark:bg-slate-900/50">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Select where we should deliver</p>
          <button
            type="button"
            onClick={() => setAddressModalOpen(true)}
            className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Choose address
          </button>
        </div>
      )}

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
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 text-sm">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-slate-400">—</div>
                  )}
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
              <span className="tabular-nums">Rs. {grandTotal}</span>
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
              Name and phone come from your selected address. Change it with the button above if needed.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
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
            ) : !user ? (
              "Sign in to place order"
            ) : paymentMethod === "razorpay" ? (
              "Pay with Razorpay"
            ) : (
              "Place order"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
