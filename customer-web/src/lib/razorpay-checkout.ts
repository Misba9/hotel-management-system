/**
 * Loads Razorpay Checkout script and opens the payment modal.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration
 */

export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const w = window as unknown as { Razorpay?: RazorpayConstructor };
    if (typeof w.Razorpay === "function") {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type OpenRazorpayCheckoutParams = {
  keyId: string;
  amountPaise: number;
  currency: string;
  orderId: string;
  businessName?: string;
  description?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  onSuccess: (response: RazorpayHandlerResponse) => void;
  onDismiss?: () => void;
  onFailed?: (err: { error?: { description?: string } }) => void;
};

export async function openRazorpayCheckout(params: OpenRazorpayCheckoutParams): Promise<boolean> {
  if (!params.keyId?.trim()) return false;
  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === "undefined") return false;

  const w = window as unknown as { Razorpay?: RazorpayConstructor };
  if (typeof w.Razorpay !== "function") return false;

  const options: Record<string, unknown> = {
    key: params.keyId,
    amount: params.amountPaise,
    currency: params.currency,
    name: params.businessName ?? "Order checkout",
    description: params.description ?? "Food order",
    order_id: params.orderId,
    prefill: {
      name: params.customerName,
      contact: params.customerPhone.replace(/\D/g, "").slice(-15),
      ...(params.customerEmail ? { email: params.customerEmail } : {})
    },
    theme: { color: "#ea580c" },
    handler(response: RazorpayHandlerResponse) {
      params.onSuccess(response);
    },
    modal: {
      ondismiss() {
        params.onDismiss?.();
      }
    }
  };

  const rp = new w.Razorpay(options);
  rp.open();
  return true;
}
