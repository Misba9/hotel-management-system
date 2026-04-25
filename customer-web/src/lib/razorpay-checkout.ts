/**
 * Loads Razorpay Checkout script and opens the payment modal.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/
 *
 * **Dashboard (required for UPI / QR)** — Razorpay Dashboard → Settings → Payment methods:
 * enable **UPI**, **UPI Intent**, and **UPI QR** for your account. Test mode can limit UPI/QR;
 * use **live** keys for full QR testing when your account is activated.
 *
 * **CDN / ad blockers** — Allow `checkout.razorpay.com` (script + assets). Blocking them breaks the modal and images.
 *
 * **Preload console warnings** — Checkout may preload `checkout-static-next.razorpay.com` assets; if you open the modal
 * late, Chrome can warn they were unused. That is benign and not a failed payment load.
 *
 * ## Debug checklist (dev)
 * 1. **Console** — No “blocked” / CSP errors for `checkout.razorpay.com`. Disable ad blockers for this site.
 * 2. **Network** — `checkout.js` (200) from `https://checkout.razorpay.com/v1/checkout.js`; then XHR/fetch to Razorpay as you pay.
 * 3. **Dashboard** — Payment methods: **UPI**, **UPI Intent**, **UPI QR** enabled (test mode may hide some flows).
 * 4. **Images** — `NEXT_PUBLIC_RAZORPAY_CHECKOUT_LOGO_URL` must be `https://` (never `http://localhost/...`). Product images: same (see `resolveMenuImageSrc`).
 * 5. **Prefill** — Use a valid **10-digit Indian mobile** (`6–9` then 9 digits) on `contact` for UPI intent / QR; no custom `config.display` (it can hide methods).
 */

/** Official Standard Checkout script URL (layout `preconnect` / `dns-prefetch` use this origin). */
export const RAZORPAY_CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js" as const;

/** Stable id so we only attach one checkout.js `<script>` per page load. */
export const RAZORPAY_CHECKOUT_SCRIPT_ID = "razorpay-checkout-js";

function razorpayDevWarn(message: string): void {
  if (process.env.NODE_ENV === "development" && typeof console !== "undefined") {
    console.warn(`[Razorpay] ${message}`);
  }
}

export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

/**
 * Indian mobile for Razorpay `prefill.contact` (UPI / QR). Last 10 digits after stripping `+91` etc.;
 * must match `[6-9]#########` or Checkout may omit UPI / QR flows.
 */
export function normalizeIndiaMobileForRazorpay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length === 10 && /^[6-9]\d{9}$/.test(last10)) return last10;
  return "";
}

function checkoutLogoUrl(): string | undefined {
  if (typeof process === "undefined" || typeof process.env === "undefined") return undefined;
  const u = process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_LOGO_URL?.trim();
  if (!u || !u.startsWith("https://")) return undefined;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return undefined;
    return u;
  } catch {
    return undefined;
  }
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
    const byId = document.getElementById(RAZORPAY_CHECKOUT_SCRIPT_ID);
    if (byId && byId instanceof HTMLScriptElement) {
      if (typeof w.Razorpay === "function") {
        resolve(true);
        return;
      }
      byId.addEventListener("load", () => resolve(true));
      byId.addEventListener("error", () => {
        razorpayDevWarn(
          "checkout.js failed to load (existing script tag). Check Network tab, ad blockers, and VPN. URL: " +
            RAZORPAY_CHECKOUT_SCRIPT_SRC
        );
        resolve(false);
      });
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${RAZORPAY_CHECKOUT_SCRIPT_SRC}"]`
    );
    if (existing) {
      if (typeof w.Razorpay === "function") {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => {
        razorpayDevWarn("checkout.js failed to load (duplicate src). See debug checklist in razorpay-checkout.ts.");
        resolve(false);
      });
      return;
    }
    const s = document.createElement("script");
    s.id = RAZORPAY_CHECKOUT_SCRIPT_ID;
    s.src = RAZORPAY_CHECKOUT_SCRIPT_SRC;
    s.async = true;
    /** Do not set `crossOrigin` here — Razorpay’s script may not send ACAO; that would block execution. */
    s.referrerPolicy = "strict-origin-when-cross-origin";
    s.onload = () => resolve(true);
    s.onerror = () => {
      razorpayDevWarn(
        "checkout.js failed to load (injected script). Confirm URL in Network is not blocked (ERR_BLOCKED_BY_CLIENT, CSP, etc.)."
      );
      resolve(false);
    };
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
  const orderId = params.orderId?.trim() ?? "";
  if (!orderId) {
    razorpayDevWarn("Missing order_id — create-order did not return a Razorpay order id.");
    return false;
  }
  if (!Number.isFinite(params.amountPaise) || params.amountPaise < 100) {
    razorpayDevWarn(`Invalid amount (paise): ${params.amountPaise}. Must be a finite integer ≥ 100.`);
    return false;
  }
  if (!params.keyId?.trim()) {
    razorpayDevWarn("Missing keyId — check /api/create-order returns keyId.");
    return false;
  }
  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === "undefined") {
    razorpayDevWarn("checkout.js not available after loadRazorpayScript(). Open Network → filter checkout.js.");
    return false;
  }

  const w = window as unknown as { Razorpay?: RazorpayConstructor };
  if (typeof w.Razorpay !== "function") {
    razorpayDevWarn("window.Razorpay is not a function after script load — script may have been blocked or failed.");
    return false;
  }

  const contact = normalizeIndiaMobileForRazorpay(params.customerPhone);
  if (!contact) {
    razorpayDevWarn(
      "prefill.contact is missing or not a valid 10-digit Indian mobile — UPI / QR may not show. Use delivery phone like 9876543210."
    );
  }
  const displayName = params.customerName?.trim() || "Customer";
  const emailTrim = params.customerEmail?.trim();
  const emailOk =
    emailTrim && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) ? emailTrim : undefined;

  if (process.env.NODE_ENV === "development" && typeof console !== "undefined") {
    console.log("[Razorpay] checkout", {
      order_id: orderId,
      amount_paise: params.amountPaise,
      currency: params.currency,
      contact_set: Boolean(contact)
    });
  }

  const logo = checkoutLogoUrl();

  const options: Record<string, unknown> = {
    key: params.keyId,
    amount: Math.round(params.amountPaise),
    currency: params.currency,
    name: params.businessName ?? "Nausheen Fruits",
    description: params.description ?? "Order payment",
    order_id: orderId,
    /** Explicit methods — helps Checkout list UPI alongside card / NB / wallet. */
    method: {
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
      emi: false
    },
    ...(logo ? { image: logo } : {}),
    prefill: {
      name: displayName,
      ...(contact ? { contact } : {}),
      ...(emailOk ? { email: emailOk } : {})
    },
    theme: { color: "#ff6600" },
    handler(response: RazorpayHandlerResponse) {
      queueMicrotask(() => {
        params.onSuccess(response);
      });
    },
    modal: {
      ondismiss() {
        queueMicrotask(() => {
          params.onDismiss?.();
        });
      }
    }
  };

  try {
    const rp = new w.Razorpay(options);
    rp.open();
    return true;
  } catch (e) {
    razorpayDevWarn(`Razorpay constructor/open failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
