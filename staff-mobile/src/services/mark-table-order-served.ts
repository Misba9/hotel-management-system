import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "./orders.js";

/**
 * Waiter marks a table ticket served after kitchen marks READY (see Firestore rules).
 */
export async function markTableOrderServed(orderId: string): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order.");

  const ref = doc(staffDb, ORDERS_COLLECTION, id);
  await updateDoc(ref, {
    status: "SERVED",
    updatedAt: serverTimestamp()
  });
}

export function formatMarkServedError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") {
      return "Not allowed to update this order (must be READY and a table ticket).";
    }
    return err.message || "Update failed.";
  }
  if (err instanceof Error) return err.message;
  return "Could not mark served.";
}
