import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createRazorpayOrder,
  readRazorpayCredentials,
  verifyRazorpayPaymentSignature,
  type RazorpayCredentials
} from "./razorpay-core";

export type RazorpayInitiateBody = {
  orderId: string;
  method: "upi" | "online" | "card";
  amountPaise: number;
};

export type RazorpayVerifyBody = {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return (raw ? JSON.parse(raw) : {}) as T;
}

function credentialsFromEnv(env: Record<string, string | undefined>): RazorpayCredentials {
  const creds = readRazorpayCredentials(env);
  if (!creds) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in admin-dashboard/.env.local");
  }
  return creds;
}

export async function handleRazorpayInitiate(
  body: RazorpayInitiateBody,
  env: Record<string, string | undefined>
) {
  const credentials = credentialsFromEnv(env);
  if (!body.orderId?.trim()) throw new Error("orderId is required.");
  const amountPaise = Math.round(Number(body.amountPaise));
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    throw new Error("Invalid payment amount.");
  }

  const order = await createRazorpayOrder({
    credentials,
    amountPaise,
    receipt: `pos_${body.orderId}`.slice(0, 40),
    notes: {
      orderId: body.orderId,
      method: body.method,
      source: "staff-desktop"
    }
  });

  return {
    success: true,
    razorpayOrderId: order.id,
    keyId: credentials.keyId,
    currency: order.currency
  };
}

export async function handleRazorpayVerify(body: RazorpayVerifyBody, env: Record<string, string | undefined>) {
  const credentials = credentialsFromEnv(env);
  if (!body.orderId || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
    throw new Error("Missing payment verification fields.");
  }

  const valid = verifyRazorpayPaymentSignature({
    keySecret: credentials.keySecret,
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    razorpaySignature: body.razorpaySignature
  });

  if (!valid) throw new Error("Invalid payment signature.");

  return { success: true, orderId: body.orderId };
}

export async function handleRazorpayPosHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: Record<string, string | undefined>
) {
  const url = req.url ?? "";
  const path = url.split("?")[0] ?? "";

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && path.endsWith("/key")) {
      const credentials = credentialsFromEnv(env);
      sendJson(res, 200, { success: true, keyId: credentials.keyId });
      return;
    }

    if (req.method === "POST" && path.endsWith("/initiate")) {
      const body = await readJsonBody<RazorpayInitiateBody>(req);
      const result = await handleRazorpayInitiate(body, env);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && path.endsWith("/verify")) {
      const body = await readJsonBody<RazorpayVerifyBody>(req);
      const result = await handleRazorpayVerify(body, env);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { success: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay request failed.";
    sendJson(res, 400, { success: false, error: message });
  }
}

export const RAZORPAY_POS_API_PREFIX = "/api/pos/razorpay";
