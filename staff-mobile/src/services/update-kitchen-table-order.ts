import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "./orders.js";

export async function acceptKitchenTableOrder(orderId: string): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order.");
  await updateDoc(doc(staffDb, ORDERS_COLLECTION, id), {
    status: "PREPARING",
    updatedAt: serverTimestamp()
  });
}

export async function markKitchenTableOrderReady(orderId: string): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order.");
  await updateDoc(doc(staffDb, ORDERS_COLLECTION, id), {
    status: "READY",
    updatedAt: serverTimestamp()
  });
}

export function formatKitchenOrderUpdateError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") {
      return "Not allowed to update this order. Sign in as kitchen staff with an active profile.";
    }
    return err.message || "Update failed.";
  }
  if (err instanceof Error) return err.message;
  return "Could not update order.";
}
