import { FirebaseError } from "firebase/app";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { ORDERS_COLLECTION } from "./orders.js";
import type { PlaceTableOrderInput, TableOrderLineInput } from "./place-table-order";
import { formatPlaceOrderError, placeTableOrder } from "./place-table-order";
import { formatMarkServedError, markTableOrderServed } from "./mark-table-order-served";
import { formatRequestBillError, requestTableOrderBill } from "./request-table-order-bill";

export type { TableOrderLineInput, PlaceTableOrderInput };
export { ORDERS_COLLECTION, formatPlaceOrderError, formatMarkServedError, formatRequestBillError };

/**
 * Creates `orders/{id}` with status PLACED and marks the table OCCUPIED — kitchen queue picks it up.
 * Alias for product language (“Send to kitchen”).
 */
export async function sendOrderToKitchen(input: PlaceTableOrderInput): Promise<{ orderId: string }> {
  return placeTableOrder(input);
}

/**
 * Creates a table ticket and wires it to the floor row.
 *
 * Steps (atomic batch):
 * 1. Create `orders/{orderId}` (table service shape, status PLACED).
 * 2. Update `tables/{tableId}`: `status` = OCCUPIED, `currentOrderId` = orderId.
 *
 * @returns `orderId`
 */
export async function createOrder(tableId: string, input: Omit<PlaceTableOrderInput, "tableId">): Promise<string> {
  const { orderId } = await placeTableOrder({ ...input, tableId });
  return orderId;
}

export { placeTableOrder, markTableOrderServed, requestTableOrderBill };

type NormalizedLine = { menuItemId: string; name: string; price: number; quantity: number };

function normalizeLine(raw: Record<string, unknown>): NormalizedLine {
  const menuItemId =
    typeof raw.menuItemId === "string"
      ? raw.menuItemId
      : typeof raw.id === "string"
        ? raw.id
        : "";
  const name = typeof raw.name === "string" ? raw.name : "Item";
  const price = Number(raw.price ?? raw.unitPrice ?? 0);
  const quantity = Number(raw.quantity ?? raw.qty ?? 1);
  return {
    menuItemId: menuItemId || `line_${name}`,
    name,
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  };
}

function parseItems(raw: unknown): NormalizedLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => normalizeLine((row && typeof row === "object" ? row : {}) as Record<string, unknown>));
}

function mergeLines(existing: NormalizedLine[], additions: TableOrderLineInput[]): NormalizedLine[] {
  const map = new Map<string, NormalizedLine>();
  for (const l of existing) {
    map.set(l.menuItemId, { ...l });
  }
  for (const a of additions) {
    const prev = map.get(a.menuItemId);
    if (prev) {
      map.set(a.menuItemId, { ...prev, quantity: prev.quantity + a.quantity });
    } else {
      map.set(a.menuItemId, {
        menuItemId: a.menuItemId,
        name: a.name,
        price: a.price,
        quantity: a.quantity
      });
    }
  }
  return [...map.values()];
}

function totalFor(lines: NormalizedLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
}

/**
 * Merge extra menu lines into an open table ticket (waiter). Allowed while kitchen has not finished (PLACED / PREPARING).
 */
export async function appendItemsToTableOrder(orderId: string, lines: TableOrderLineInput[]): Promise<void> {
  const id = orderId?.trim();
  if (!id) throw new Error("Missing order.");
  if (lines.length === 0) throw new Error("Nothing to add.");

  const ref = doc(staffDb, ORDERS_COLLECTION, id);
  await runTransaction(staffDb, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Order not found.");
    const data = snap.data() as Record<string, unknown>;
    const orderType = String(data.orderType ?? "").toLowerCase();
    if (orderType !== "table") throw new Error("Only table orders can be edited here.");

    const status = String(data.status ?? "").trim().toUpperCase();
    if (status !== "PLACED" && status !== "PREPARING") {
      throw new Error("Items can only be added while the ticket is PLACED or PREPARING.");
    }

    const existing = parseItems(data.items);
    const merged = mergeLines(existing, lines);
    const totalAmount = totalFor(merged);

    transaction.update(ref, {
      items: merged,
      totalAmount,
      updatedAt: serverTimestamp()
    });
  });
}

export function formatAppendItemsError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") return "Permission denied. Check Firestore rules for waiters.";
    return err.message || "Could not update order.";
  }
  if (err instanceof Error) return err.message;
  return "Could not add items.";
}
