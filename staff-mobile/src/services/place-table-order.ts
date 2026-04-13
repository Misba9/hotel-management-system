import { FirebaseError } from "firebase/app";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { TABLES_COLLECTION } from "../hooks/use-tables";
import { ORDERS_COLLECTION } from "./orders.js";

export type TableOrderLineInput = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type PlaceTableOrderInput = {
  uid: string;
  tableId: string;
  tableNumber: number;
  lines: TableOrderLineInput[];
  totalAmount: number;
};

export type PlaceTableOrderResult = { orderId: string };

/**
 * Atomically creates `orders/{orderId}` (table service shape) and sets `tables/{tableId}.status` to OCCUPIED.
 */
export async function placeTableOrder(input: PlaceTableOrderInput): Promise<PlaceTableOrderResult> {
  const { uid, tableId, tableNumber, lines, totalAmount } = input;
  if (!uid) throw new Error("Not signed in.");
  if (!tableId?.trim()) throw new Error("Missing table.");
  if (!Number.isFinite(tableNumber)) throw new Error("Invalid table number.");
  if (lines.length === 0) throw new Error("Cart is empty.");
  if (!Number.isFinite(totalAmount) || totalAmount < 0) throw new Error("Invalid total.");

  const orderRef = doc(collection(staffDb, ORDERS_COLLECTION));
  const orderId = orderRef.id;
  const tableRef = doc(staffDb, TABLES_COLLECTION, tableId);

  const items = lines.map((l) => ({
    menuItemId: l.menuItemId,
    name: l.name,
    price: l.price,
    quantity: l.quantity
  }));

  const batch = writeBatch(staffDb);
  batch.set(orderRef, {
    id: orderId,
    userId: uid,
    createdByUid: uid,
    tableId,
    tableNumber,
    orderType: "table",
    items,
    totalAmount,
    status: "PLACED",
    paymentStatus: "PENDING",
    createdAt: serverTimestamp()
  });
  batch.update(tableRef, { status: "OCCUPIED" });

  try {
    await batch.commit();
  } catch (e) {
    if (e instanceof FirebaseError) {
      if (e.code === "permission-denied") {
        throw new Error("You do not have permission to place this order or update the table. Check Firestore rules.");
      }
      if (e.code === "not-found") {
        throw new Error("Table document was not found.");
      }
    }
    throw e instanceof Error ? e : new Error("Failed to place order.");
  }

  return { orderId };
}

export function formatPlaceOrderError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") return "Permission denied. Sign in as an active waiter and try again.";
    if (err.code === "not-found") return "Table or order path not found.";
    return err.message || "Something went wrong.";
  }
  if (err instanceof Error) return err.message;
  return "Could not place order.";
}
