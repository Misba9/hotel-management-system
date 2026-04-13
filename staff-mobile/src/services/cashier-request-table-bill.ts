import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "./orders.js";

/**
 * Cashier requests a bill for a table ticket still at `paymentStatus == "PENDING"` (see Firestore rules).
 */
export async function cashierRequestTableBill(orderId: string): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order id.");
  await updateDoc(doc(staffDb, ORDERS_COLLECTION, id), {
    paymentStatus: "REQUESTED",
    updatedAt: serverTimestamp()
  });
}

export function formatCashierRequestBillError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") {
      return "Not allowed. Sign in as cashier with an active profile; order must be a table ticket with payment PENDING.";
    }
    return err.message || "Could not request bill.";
  }
  if (err instanceof Error) return err.message;
  return "Could not request bill.";
}
