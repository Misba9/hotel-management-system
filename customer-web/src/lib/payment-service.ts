/**
 * Client-side Razorpay helpers: create payment order via API, load script, open checkout.
 */
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
  /** Expected order total in INR (optional; server rejects if it does not match computed total). */
  amount?: number;
};

export type CreatePaymentOrderResult =
  | {
      ok: true;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
    }
  | { ok: false; error: string; status?: number };

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
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      razorpayOrderId?: string;
      amount?: number;
      currency?: string;
      keyId?: string;
    };
    if (
      !res.ok ||
      !json.success ||
      typeof json.razorpayOrderId !== "string" ||
      typeof json.amount !== "number"
    ) {
      return { ok: false, error: json.error ?? "Could not start online payment.", status: res.status };
    }
    return {
      ok: true,
      razorpayOrderId: json.razorpayOrderId,
      amount: json.amount,
      currency: json.currency ?? "INR",
      keyId: json.keyId ?? ""
    };
  } catch {
    return { ok: false, error: "Network error while creating payment order." };
  }
}

export { loadRazorpayScript, openRazorpayCheckout, type OpenRazorpayCheckoutParams, type RazorpayHandlerResponse };
