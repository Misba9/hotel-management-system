import crypto from "node:crypto";

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
};

export function readRazorpayCredentials(env: Record<string, string | undefined>): RazorpayCredentials | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

type RazorpayOrderResponse = {
  id?: string;
  currency?: string;
  error?: { description?: string };
};

export async function createRazorpayOrder(params: {
  credentials: RazorpayCredentials;
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; currency: string }> {
  const amount = Math.round(params.amountPaise);
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error("Amount must be at least ₹1.00 (100 paise).");
  }

  const auth = Buffer.from(`${params.credentials.keyId}:${params.credentials.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount,
      currency: params.currency ?? "INR",
      receipt: params.receipt.slice(0, 40),
      ...(params.notes ? { notes: params.notes } : {})
    })
  });

  const text = await res.text();
  let data: RazorpayOrderResponse | null = null;
  try {
    data = text ? (JSON.parse(text) as RazorpayOrderResponse) : null;
  } catch {
    data = null;
  }

  if (!res.ok || !data?.id) {
    const desc = data?.error?.description ?? text?.slice(0, 200) ?? `HTTP ${res.status}`;
    throw new Error(desc);
  }

  return { id: data.id, currency: data.currency ?? "INR" };
}

export function verifyRazorpayPaymentSignature(params: {
  keySecret: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", params.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return expected === params.razorpaySignature;
}
