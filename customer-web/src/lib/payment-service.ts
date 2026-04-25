/**
 * Client-side Razorpay helpers: create payment order via API, load script, open checkout.
 */
import type { SerializedDeliveryAddress } from "@/lib/delivery-address-types";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type OpenRazorpayCheckoutParams,
  type RazorpayHandlerResponse
} from "@/lib/razorpay-checkout";

export const RAZORPAY_CREATE_ORDER_PATH = "/api/create-order";

export type CreatePaymentOrderBody = {
  customerName: string;
  phone: string;
  items: Array<{ id: string; name?: string; price?: number; quantity: number }>;
  couponCode?: string;
  orderType?: "delivery" | "pickup" | "dine_in";
  address: string;
  deliveryAddress?: SerializedDeliveryAddress;
  /** Optional client total in INR — server recomputes from DB; used only to detect drift. */
  amount?: number;
};

export type CreatePaymentOrderResult =
  | {
      ok: true;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
      recalculatedTotal: number;
    }
  | {
      ok: false;
      priceUpdated: true;
      correctTotal: number;
      message: string;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      code?: "RAZORPAY_NOT_CONFIGURED" | string;
    };

/**
 * POST /api/create-order — returns Razorpay order id and amount in paise (server-priced).
 */
export async function createRazorpayPaymentOrder(
  body: CreatePaymentOrderBody,
  headers: HeadersInit
): Promise<CreatePaymentOrderResult> {
  try {
    const res = await fetch(RAZORPAY_CREATE_ORDER_PATH, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    let json: {
      success?: boolean;
      error?: string;
      code?: string;
      message?: string;
      correctTotal?: number;
      recalculatedTotal?: number;
      razorpayOrderId?: string;
      orderId?: string;
      id?: string;
      amount?: number;
      currency?: string;
      keyId?: string;
    } = {};

    try {
      const text = await res.text();
      if (text) {
        json = JSON.parse(text) as typeof json;
      }
    } catch {
      return {
        ok: false,
        error: "Invalid response from payment server.",
        status: res.status
      };
    }

    if (res.status === 200 && json.success === false && typeof json.correctTotal === "number") {
      return {
        ok: false,
        priceUpdated: true,
        correctTotal: json.correctTotal,
        message: typeof json.message === "string" ? json.message : "Price updated"
      };
    }

    const razorpayOrderId =
      typeof json.razorpayOrderId === "string"
        ? json.razorpayOrderId
        : typeof json.orderId === "string"
          ? json.orderId
          : typeof json.id === "string"
            ? json.id
            : undefined;

    if (!res.ok || !json.success || typeof razorpayOrderId !== "string" || typeof json.amount !== "number") {
      const code =
        json.code === "RAZORPAY_NOT_CONFIGURED" || res.status === 503 ? "RAZORPAY_NOT_CONFIGURED" : json.code;
      return {
        ok: false,
        error: json.error ?? "Could not start online payment.",
        status: res.status,
        ...(code ? { code } : {})
      };
    }

    const recalculated =
      typeof json.recalculatedTotal === "number" && Number.isFinite(json.recalculatedTotal)
        ? json.recalculatedTotal
        : json.amount! / 100;

    return {
      ok: true,
      razorpayOrderId,
      amount: json.amount,
      currency: json.currency ?? "INR",
      keyId: json.keyId ?? "",
      recalculatedTotal: recalculated
    };
  } catch {
    return { ok: false, error: "Network error while creating payment order." };
  }
}

export function shouldFallbackRazorpayToCod(result: CreatePaymentOrderResult): boolean {
  if (result.ok) return false;
  if ("priceUpdated" in result && result.priceUpdated) return false;
  if (!("error" in result)) return false;
  if (result.status === 503) return true;
  if (result.code === "RAZORPAY_NOT_CONFIGURED") return true;
  const msg = (result.error ?? "").toLowerCase();
  return msg.includes("not configured") || msg.includes("razorpay is not configured");
}

export { loadRazorpayScript, openRazorpayCheckout, type OpenRazorpayCheckoutParams, type RazorpayHandlerResponse };
