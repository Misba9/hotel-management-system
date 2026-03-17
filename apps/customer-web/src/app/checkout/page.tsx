"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { useCart } from "@/components/providers/cart-provider";
import { useToast } from "@/components/providers/toast-provider";
import { buildAuthHeaders } from "@/lib/user-session";

type CheckoutItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type PlaceOrderResponse = {
  success: boolean;
  order?: {
    id: string;
    items: CheckoutItem[];
    pricing?: {
      subtotal: number;
      discount: number;
      taxPercent: number;
      taxAmount: number;
      deliveryFee: number;
      total: number;
    };
    total: number;
    createdAt: string;
  };
  tracking?: {
    id: string;
    token: string;
  };
  payment?: {
    method: "upi" | "card" | "cod";
    razorpayOrderId: string | null;
  };
  error?: string;
};

type OrderSuccessView = {
  trackingId: string;
  trackingToken: string;
  total: number;
  address: string;
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
  const { items, subtotal, discount, couponCode, total, clearCart } = useCart();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderSuccessView | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [address, setAddress] = useState("Banjara Hills, Hyderabad");
  const [name, setName] = useState("Ahmed Khan");
  const [phone, setPhone] = useState("+91 9XXXXXXXXX");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cod">("cod");
  const [message, setMessage] = useState("");

  async function ensureRazorpayScript() {
    if (typeof window === "undefined") return false;
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay script"));
      document.body.appendChild(script);
    });
    return Boolean((window as unknown as { Razorpay?: unknown }).Razorpay);
  }

  async function verifyRazorpayPayment(payload: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const res = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    const data = parseJsonSafe<{ success?: boolean; error?: string }>(text);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error ?? "Payment verification failed");
    }
  }

  async function placeOrder() {
    setSubmitting(true);
    setMessage("");
    try {
      if (items.length === 0) {
        throw new Error("Your cart is empty");
      }

      const checkoutItems: CheckoutItem[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty
      }));
      const orderData = {
        items: checkoutItems,
        couponCode: couponCode || undefined,
        branchId: "hyderabad-main",
        orderType: "delivery",
        paymentMethod,
        address
      };
      const headers = await buildAuthHeaders({ "Content-Type": "application/json" });

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify(orderData)
      });

      const text = await res.text();
      const data = parseJsonSafe<PlaceOrderResponse>(text);

      if (!res.ok || !data?.success || !data.order) {
        throw new Error(data?.error ?? "Checkout failed");
      }
      if (!data.tracking?.id || !data.tracking?.token) {
        throw new Error("Tracking details were not generated.");
      }

      if (paymentMethod !== "cod") {
        if (!data.payment?.razorpayOrderId) {
          throw new Error("Razorpay order was not created");
        }
        const scriptReady = await ensureRazorpayScript();
        if (!scriptReady) {
          throw new Error("Unable to initialize payment gateway");
        }

        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID");

        await new Promise<void>((resolve, reject) => {
          const Razorpay = (window as unknown as { Razorpay: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
          const razorpay = new Razorpay({
            key: keyId,
            amount: data.order!.total * 100,
            currency: "INR",
            name: "Nausheen Fruits Juice Center",
            description: "Order payment",
            order_id: data.payment!.razorpayOrderId,
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              try {
                await verifyRazorpayPayment({
                  orderId: data.order!.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                });
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment was cancelled"))
            }
          });
          razorpay.open();
        });
      }

      window.localStorage.setItem(
        "nausheen_last_tracking",
        JSON.stringify({ trackingId: data.tracking.id, trackingToken: data.tracking.token })
      );
      window.localStorage.setItem("nausheen_last_order_id", data.order.id);
      setResult({
        trackingId: data.tracking.id,
        trackingToken: data.tracking.token,
        total: data.order.total,
        address
      });
      setMessage("Order placed successfully.");
      showToast({
        title: "Order placed successfully",
        description: `Order #${data.order.id}`
      });
      clearCart();
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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <CheckoutStepper step={step} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">1. Address</h3>
              <button onClick={() => setStep(1)} className="text-xs text-orange-600">Edit</button>
            </div>
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Full name"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Phone number"
              />
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Enter delivery address"
            />
            <p className="mt-1 text-xs text-slate-500">Estimated delivery: 28 mins</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">2. Payment Method</h3>
              <button onClick={() => setStep(2)} className="text-xs text-orange-600">Edit</button>
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex gap-2">
                <input
                  type="radio"
                  name="payment"
                  value="upi"
                  checked={paymentMethod === "upi"}
                  onChange={() => setPaymentMethod("upi")}
                />
                UPI
              </label>
              <label className="flex gap-2">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                />
                Card
              </label>
              <label className="flex gap-2">
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                />
                Cash on Delivery
              </label>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold">3. Confirm Order</h3>
            <div className="h-40 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-4 text-sm text-slate-600">
              Map Preview (Google Maps)
            </div>
            <button
              onClick={() => {
                setStep(3);
                void placeOrder();
              }}
              disabled={submitting || items.length === 0}
              className="mt-4 rounded-xl bg-orange-500 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Placing..." : "Place Order"}
            </button>
          </div>
        </motion.div>
        <aside className="rounded-2xl border bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold">Order Summary</h3>
          <div className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.name} x{item.qty}
                </span>
                <span>Rs. {item.qty * item.price}</span>
              </div>
            ))}
            <div className="flex justify-between"><span>Subtotal</span><span>Rs. {subtotal}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-Rs. {discount}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>Rs. 40</span></div>
            <div className="border-t pt-2 font-semibold">
              <div className="flex justify-between"><span>Total</span><span>Rs. {Math.max(total, 0) + 40}</span></div>
            </div>
          </div>
        </aside>
      </div>
      {message && (
        <div className={`rounded-xl p-4 text-sm ${result ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}
      {result && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
          Tracking ID: <span className="font-semibold">{result.trackingId}</span>, Total Rs. {result.total}
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/tracking?trackingId=${encodeURIComponent(result.trackingId)}&t=${encodeURIComponent(result.trackingToken)}`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white"
            >
              Track Order
            </Link>
            <p className="text-xs text-slate-600 dark:text-slate-300">Delivery to: {result.address}</p>
          </div>
        </div>
      )}
    </section>
  );
}
