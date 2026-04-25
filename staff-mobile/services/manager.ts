import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe
} from "firebase/firestore";

import { normalizeStaffUsersRowRole } from "@shared/utils/staff-access-control";

import { staffDb } from "../src/lib/firebase";
import { STAFF_USERS_COLLECTION } from "../src/navigation/staff-role-routes";
import { DELIVERIES_COLLECTION, fetchDeliveryByOrderId } from "./delivery";
import type { StaffOrderRow } from "./orders";

export type StaffDirectoryRow = {
  uid: string;
  name: string;
  email: string;
  roleLabel: string;
  roleNorm: string | null;
  isActive: boolean;
};

function mapStaffUserDoc(id: string, data: Record<string, unknown>): StaffDirectoryRow {
  const name =
    (typeof data.name === "string" && data.name.trim()) ||
    (typeof data.email === "string" && data.email.split("@")[0]) ||
    id.slice(0, 8);
  const email = typeof data.email === "string" ? data.email : "";
  const rawRole = data.role;
  const norm = normalizeStaffUsersRowRole(rawRole);
  const roleLabel =
    typeof rawRole === "string" && rawRole.trim()
      ? rawRole.trim()
      : norm === "pending"
        ? "pending"
        : norm ?? "—";
  const isActive = data.isActive === true;
  return { uid: id, name, email, roleLabel, roleNorm: norm, isActive };
}

/** Live roster from `staff_users` (bounded). */
export function subscribeStaffDirectory(
  onNext: (rows: StaffDirectoryRow[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(staffDb, STAFF_USERS_COLLECTION), limit(400));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapStaffUserDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      onNext(rows);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

export function isDeliveryRiderRow(row: StaffDirectoryRow): boolean {
  return row.roleNorm === "delivery";
}

function deliveryPayloadFromOrder(order: StaffOrderRow): { customerName: string; mobile: string; address: string } {
  const name = order.customer?.name?.trim() || "Customer";
  const phone = order.customer?.phone?.trim() || "";
  const addr =
    order.customer?.address?.trim() ||
    (typeof order.tableNumber === "number" ? `Table ${order.tableNumber}` : "") ||
    "Address on file";
  return { customerName: name, mobile: phone, address: addr };
}

/** Creates a delivery run or reassigns rider (`deliveries` rules: manager/cashier/admin). */
export async function assignDeliveryBoyToOrder(order: StaffOrderRow, riderUid: string): Promise<void> {
  const trimmed = riderUid.trim();
  if (!trimmed) throw new Error("Select a rider.");

  const existing = await fetchDeliveryByOrderId(order.id);
  const { customerName, mobile, address } = deliveryPayloadFromOrder(order);

  if (existing) {
    const ref = doc(staffDb, DELIVERIES_COLLECTION, existing.id);
    await updateDoc(ref, {
      deliveryBoyId: trimmed,
      updatedAt: serverTimestamp()
    });
    return;
  }

  await addDoc(collection(staffDb, DELIVERIES_COLLECTION), {
    orderId: order.id,
    customerName,
    mobile,
    address,
    status: "assigned",
    deliveryBoyId: trimmed,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
