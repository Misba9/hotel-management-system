import {
  handleRazorpayInitiate,
  handleRazorpayVerify,
  type RazorpayInitiateBody,
  type RazorpayVerifyBody
} from "../server/razorpay-pos-api";

export async function razorpayInitiatePayment(body: RazorpayInitiateBody, env: NodeJS.ProcessEnv) {
  return handleRazorpayInitiate(body, env);
}

export async function razorpayVerifyPayment(body: RazorpayVerifyBody, env: NodeJS.ProcessEnv) {
  return handleRazorpayVerify(body, env);
}

export function readRazorpayPublicKey(env: NodeJS.ProcessEnv): string {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  if (!keyId) throw new Error("RAZORPAY_KEY_ID is not configured.");
  return keyId;
}
