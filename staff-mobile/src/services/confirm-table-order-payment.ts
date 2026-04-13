import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { validateTableOrderCompleteAndFreeTable } from "@shared/utils/order-update-validation";
import { staffDb } from "../lib/firebase";
import { TABLES_COLLECTION } from "../hooks/use-tables";
import { ORDERS_COLLECTION } from "./orders.js";

async function resolveTableDocIdsForOrder(data: Record<string, unknown>): Promise<string[]> {
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (tableId) return [tableId];
  const tn = data.tableNumber;
  if (typeof tn !== "number" || !Number.isFinite(tn)) return [];
  const col = collection(staffDb, TABLES_COLLECTION);
  let qs = await getDocs(query(col, where("tableNumber", "==", tn), limit(10)));
  if (qs.empty) {
    qs = await getDocs(query(col, where("number", "==", tn), limit(10)));
  }
  return qs.docs.map((d) => d.id);
}

/**
 * Cashier confirms payment for a table ticket that requested a bill:
 * sets order `status` to COMPLETED, `paymentStatus` to PAID, and frees the table in one batch.
 */
export async function confirmTableOrderPayment(orderId: string): Promise<void> {
  if (!orderId?.trim()) throw new Error("Missing order id.");

  const orderRef = doc(staffDb, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) throw new Error("Order not found.");

  const data = snap.data() as Record<string, unknown>;
  if (String(data.orderType ?? "") !== "table") {
    throw new Error("This action only applies to table orders.");
  }
  const pay = String(data.paymentStatus ?? "").toUpperCase();
  if (pay === "PAID") {
    throw new Error("This order is already marked paid.");
  }
  const gate = validateTableOrderCompleteAndFreeTable({
    currentOrderStatus: String(data.status ?? ""),
    currentPaymentStatus: String(data.paymentStatus ?? "")
  });
  if (!gate.ok) {
    throw new Error(gate.message);
  }

  const tableIds = await resolveTableDocIdsForOrder(data);

  const batch = writeBatch(staffDb);
  batch.update(orderRef, {
    status: "COMPLETED",
    paymentStatus: "PAID",
    updatedAt: serverTimestamp()
  });
  for (const id of tableIds) {
    batch.update(doc(staffDb, TABLES_COLLECTION, id), { status: "FREE" });
  }

  try {
    await batch.commit();
  } catch (e) {
    if (e instanceof FirebaseError) {
      if (e.code === "permission-denied") {
        throw new Error("Permission denied. Sign in as an active cashier.");
      }
    }
    throw e instanceof Error ? e : new Error("Could not confirm payment.");
  }
}

export function formatConfirmPaymentError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") return "Permission denied. Check Firestore rules for cashier + table updates.";
    return err.message || "Could not confirm payment.";
  }
  if (err instanceof Error) return err.message;
  return "Could not confirm payment.";
}
