export const RAZORPAY_CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js" as const;
export const RAZORPAY_CHECKOUT_SCRIPT_ID = "razorpay-checkout-js";

export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

export function normalizeIndiaMobileForRazorpay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length === 10 && /^[6-9]\d{9}$/.test(last10)) return last10;
  return "";
}

function envKey(name: string): string | undefined {
  const raw = import.meta.env[name as keyof ImportMetaEnv];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function getRazorpayPublicKeyId(): string | undefined {
  return envKey("VITE_RAZORPAY_KEY_ID") ?? envKey("NEXT_PUBLIC_RAZORPAY_KEY_ID");
}

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
    const existing = document.getElementById(RAZORPAY_CHECKOUT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.id = RAZORPAY_CHECKOUT_SCRIPT_ID;
    s.src = RAZORPAY_CHECKOUT_SCRIPT_SRC;
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
  onSuccess: (response: RazorpayHandlerResponse) => void;
  onDismiss?: () => void;
};

export async function openRazorpayCheckout(params: OpenRazorpayCheckoutParams): Promise<boolean> {
  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === "undefined") return false;

  const w = window as unknown as { Razorpay?: RazorpayConstructor };
  if (typeof w.Razorpay !== "function") return false;

  const contact = normalizeIndiaMobileForRazorpay(params.customerPhone);
  const displayName = params.customerName?.trim() || "Customer";

  const options: Record<string, unknown> = {
    key: params.keyId,
    amount: Math.round(params.amountPaise),
    currency: params.currency,
    name: params.businessName ?? "Nausheen Fruits",
    description: params.description ?? "Counter order",
    order_id: params.orderId,
    method: { upi: true, card: true, netbanking: true, wallet: true, emi: false },
    prefill: {
      name: displayName,
      ...(contact ? { contact } : {})
    },
    theme: { color: "#0d9488" },
    handler(response: RazorpayHandlerResponse) {
      params.onSuccess(response);
    },
    modal: {
      ondismiss() {
        params.onDismiss?.();
      }
    }
  };

  try {
    const rp = new w.Razorpay(options);
    rp.open();
    return true;
  } catch {
    return false;
  }
}
