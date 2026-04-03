"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ORDER_SUCCESS_STORAGE_KEY, type OrderSuccessSnapshot } from "@/lib/order-success-storage";
import { buildUserHeaders } from "@/lib/user-session";

type CreateOrderResponse = {
  success: boolean;
  message?: string;
  orderId?: string;
  totalAmount?: number;
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

function validateCheckoutForm(name: string, phone: string, address: string) {
  const errors: { name?: string; phone?: string; address?: string } = {};
  const n = name.trim();
  const p = phone.trim();
  const a = address.trim();

  if (n.length < 2) {
    errors.name = "Enter your full name (at least 2 characters).";
  }

  const digits = p.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    errors.phone = "Enter a valid phone number (10–15 digits).";
  }

  if (a.length > 0 && a.length < 5) {
    errors.address = "Add a few more characters, or leave this blank.";
  }

  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, discount, couponCode, total, clearCart } = useCart();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<{ name?: string; phone?: string; address?: string }>({});

  const deliveryFee = subtotal > 0 ? 40 : 0;
  const grandTotal = useMemo(() => Math.max(total, 0) + deliveryFee, [total, deliveryFee]);

  async function placeOrder() {
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setValidationErrors({});

    try {
      if (items.length === 0) {
        throw new Error("Your cart is empty.");
      }

      const nextErrors = validateCheckoutForm(name, phone, address);
      if (Object.keys(nextErrors).length > 0) {
        setValidationErrors(nextErrors);
        throw new Error("Please fix the highlighted fields.");
      }

      const payload = {
        customerName: name.trim(),
        phone: phone.trim(),
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty
        })),
        address: address.trim() || undefined,
        couponCode: couponCode || undefined,
        orderType: "delivery" as const
      };

      const headers = await buildUserHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      const data = parseJsonSafe<CreateOrderResponse>(text);

      if (!res.ok || !data?.success || !data.orderId || typeof data.totalAmount !== "number") {
        throw new Error(data?.error ?? "Could not place order.");
      }

      const snapshot: OrderSuccessSnapshot = {
        orderId: data.orderId,
        totalAmount: data.totalAmount,
        message: data.message,
        placedAt: new Date().toISOString(),
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          lineTotal: item.price * item.qty
        }))
      };

      if (typeof window !== "undefined") {
        sessionStorage.setItem(ORDER_SUCCESS_STORAGE_KEY, JSON.stringify(snapshot));
      }

      clearCart();
      showToast({
        title: "Order placed successfully",
        description: `Order #${data.orderId}`
      });
      router.replace("/order-success");
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

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 dark:bg-slate-950 dark:text-slate-100 ${
      hasError ? "border-red-400 focus:border-red-400 focus:ring-red-400/30" : "border-slate-200 dark:border-slate-700"
    }`;

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
    <section className="mx-auto max-w-5xl space-y-6 pb-24 pt-2 md:pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review your order and enter your details.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <aside className="order-1 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:order-2 lg:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order summary</h2>
          <ul className="max-h-[min(40vh,320px)] space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
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
                    Rs. {item.price} × {item.qty}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">Rs. {item.price * item.qty}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="tabular-nums">Rs. {subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Discount</span>
              <span className="tabular-nums">-Rs. {discount}</span>
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Contact</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saved to your order in Firebase.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="checkout-name" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Customer name <span className="text-red-500">*</span>
                </label>
                <input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass(Boolean(validationErrors.name))}
                  placeholder="Full name"
                  aria-invalid={Boolean(validationErrors.name)}
                  aria-describedby={validationErrors.name ? "checkout-name-error" : undefined}
                />
                {validationErrors.name ? (
                  <p id="checkout-name-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="checkout-phone" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Phone number <span className="text-red-500">*</span>
                </label>
                <input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass(Boolean(validationErrors.phone))}
                  placeholder="e.g. 9876543210"
                  aria-invalid={Boolean(validationErrors.phone)}
                  aria-describedby={validationErrors.phone ? "checkout-phone-error" : undefined}
                />
                {validationErrors.phone ? (
                  <p id="checkout-phone-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.phone}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="checkout-address" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Address <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="checkout-address"
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`${inputClass(Boolean(validationErrors.address))} min-h-[88px] resize-y`}
                  placeholder="House / street, area, landmark…"
                  aria-invalid={Boolean(validationErrors.address)}
                  aria-describedby={validationErrors.address ? "checkout-address-error" : undefined}
                />
                {validationErrors.address ? (
                  <p id="checkout-address-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.address}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void placeOrder()}
            disabled={submitting || items.length === 0}
            aria-busy={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 disabled:pointer-events-none disabled:opacity-60 dark:bg-orange-500 dark:hover:bg-orange-400"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Placing order…
              </>
            ) : (
              "Place order"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
