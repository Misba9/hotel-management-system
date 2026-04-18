import { FirebaseError } from "firebase/app";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { TABLES_COLLECTION } from "../hooks/use-tables";
import { ORDERS_COLLECTION } from "./orders.js";

/**
 * Waiter marks a table ticket served after kitchen marks READY (see Firestore rules).
 * Atomically sets the order to SERVED and frees the floor row (`FREE`, `currentOrderId` null).
 */
export async function markTableOrderServed(orderId: string): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order.");

  const orderRef = doc(staffDb, ORDERS_COLLECTION, id);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) throw new Error("Order not found.");

  const data = snap.data() as Record<string, unknown>;
  const orderType = String(data.orderType ?? "").toLowerCase();
  if (orderType !== "table") throw new Error("Only table orders can be marked served here.");

  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (!tableId) throw new Error("Order has no table.");

  const batch = writeBatch(staffDb);
  batch.update(orderRef, {
    status: "SERVED",
    updatedAt: serverTimestamp()
  });
  batch.update(doc(staffDb, TABLES_COLLECTION, tableId), {
    status: "FREE",
    currentOrderId: null
  });
  await batch.commit();
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
