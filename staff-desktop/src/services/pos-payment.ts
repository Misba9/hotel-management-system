import { isDesktopRuntime, getDesktopApi } from "@/lib/desktop-api";

const RAZORPAY_POS_API_PREFIX = "/api/pos/razorpay";

export type InitiatePosPaymentParams = {
  orderId: string;
  method: "upi" | "online";
  amountPaise: number;
};

export type InitiatePosPaymentResult = {
  razorpayOrderId: string;
  keyId: string;
};

async function initiateViaHttp(params: InitiatePosPaymentParams): Promise<InitiatePosPaymentResult> {
  const res = await fetch(`${RAZORPAY_POS_API_PREFIX}/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: params.orderId,
      method: params.method,
      amountPaise: params.amountPaise
    })
  });
  const json = (await res.json()) as {
    success?: boolean;
    razorpayOrderId?: string;
    keyId?: string;
    error?: string;
  };
  if (!res.ok || !json.success || !json.razorpayOrderId || !json.keyId) {
    throw new Error(json.error ?? "Could not initialize Razorpay payment.");
  }
  return { razorpayOrderId: json.razorpayOrderId, keyId: json.keyId };
}

async function verifyViaHttp(payload: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  const res = await fetch(`${RAZORPAY_POS_API_PREFIX}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Payment verification failed.");
  }
}

/** Create a Razorpay order via local API (dev) or Electron IPC (production). */
export async function initiatePosRazorpayPayment(
  orderId: string,
  method: "upi" | "online",
  amountPaise: number
): Promise<InitiatePosPaymentResult> {
  const params = { orderId, method, amountPaise: Math.round(amountPaise) };

  if (isDesktopRuntime() && !import.meta.env.DEV) {
    const result = await getDesktopApi().razorpayInitiate({
      ...params,
      method: method === "online" ? "online" : "upi"
    });
    return { razorpayOrderId: result.razorpayOrderId, keyId: result.keyId };
  }

  return initiateViaHttp(params);
}

export async function verifyPosRazorpayPayment(payload: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  if (isDesktopRuntime() && !import.meta.env.DEV) {
    await getDesktopApi().razorpayVerify(payload);
    return;
  }
  await verifyViaHttp(payload);
}
