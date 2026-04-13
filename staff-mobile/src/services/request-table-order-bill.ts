import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "./orders.js";

/**
 * Waiter asks cashier to settle: sets `paymentStatus` to REQUESTED.
 * Firestore allows this only when `orderType == "table"`, `status == SERVED`, and `paymentStatus == "PENDING"`.
 */
export async function requestTableOrderBill(orderId: string): Promise<void> {
  if (!orderId?.trim()) throw new Error("Missing order id.");
  const ref = doc(staffDb, ORDERS_COLLECTION, orderId);
  await updateDoc(ref, {
    paymentStatus: "REQUESTED",
    updatedAt: serverTimestamp()
  });
}

export function formatRequestBillError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") {
      return "You can request a bill only after the order is SERVED and payment is still pending. Sign in as an active waiter.";
    }
    return err.message || "Could not request bill.";
  }
  if (err instanceof Error) return err.message;
  return "Could not request bill.";
}
