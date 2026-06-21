import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { fetchWithAuth } from "./api-client";
import { cartLinesToFirestoreItems, type CartLineInput } from "./cart-store";
import { getStaffDesktopFirestore } from "./firebase";

export type CreateCashierOrderInput = {
  uid: string;
  items: CartLineInput[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  orderType?: string;
};

export async function createCashierOrder(input: CreateCashierOrderInput): Promise<string> {
  if (input.items.length === 0) throw new Error("Cart is empty.");

  if (navigator.onLine) {
    try {
      return await createCashierOrderViaFirestore(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("permission") && !message.includes("PERMISSION")) {
        throw error;
      }
    }
  }

  return createCashierOrderViaFirestore(input);
}

async function createCashierOrderViaFirestore(input: CreateCashierOrderInput): Promise<string> {
  const db = await getStaffDesktopFirestore();
  if (!db) throw new Error("Firestore is not configured.");

  const orderRef = doc(collection(db, "orders"));
  const orderId = orderRef.id;
  const items = cartLinesToFirestoreItems(input.items);
  const ts = serverTimestamp();

  await setDoc(orderRef, {
    id: orderId,
    userId: input.uid,
    createdByUid: input.uid,
    items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    totalAmount: input.total,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: input.paymentMethod ?? "cash",
    orderType: input.orderType ?? "walk_in",
    type: input.orderType ?? "walk_in",
    source: "staff_desktop",
    createdAt: ts,
    updatedAt: ts
  });

  return orderId;
}

export async function updateOrderStatusCloud(orderId: string, status: string): Promise<void> {
  if (navigator.onLine) {
    try {
      const response = await fetchWithAuth(`/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (response.ok) return;
    } catch {
      /* fall through to Firestore */
    }
  }

  const db = await getStaffDesktopFirestore();
  if (!db) throw new Error("Firestore is not configured.");
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function syncCachedOrderToCloud(payload: Record<string, unknown>): Promise<string> {
  const db = await getStaffDesktopFirestore();
  if (!db) throw new Error("Firestore is not configured.");
  const orderRef = doc(collection(db, "orders"));
  await setDoc(orderRef, {
    ...payload,
    id: orderRef.id,
    syncedFromDesktop: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return orderRef.id;
}
