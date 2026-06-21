import { httpsCallable } from "firebase/functions";
import { getStaffDesktopFunctions } from "@/lib/firebase-functions";

export async function initiatePosRazorpayPayment(
  orderId: string,
  method: "upi" | "online"
): Promise<{ razorpayOrderId: string }> {
  const functions = await getStaffDesktopFunctions();
  if (!functions) throw new Error("Firebase Functions is not configured.");

  const fn = httpsCallable<{ orderId: string; method: "upi" | "online" }, { success: boolean; razorpayOrderId: string }>(
    functions,
    "initiateOnlinePaymentV1"
  );
  const result = await fn({ orderId, method });
  const data = result.data;
  if (!data?.razorpayOrderId) {
    throw new Error("Could not initialize Razorpay payment.");
  }
  return { razorpayOrderId: data.razorpayOrderId };
}

export async function verifyPosRazorpayPayment(payload: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  const functions = await getStaffDesktopFunctions();
  if (!functions) throw new Error("Firebase Functions is not configured.");

  const fn = httpsCallable(functions, "verifyOnlinePaymentV1");
  await fn(payload);
}
