import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { syncDeliveryTrackingDoc } from "./v1/common";

/** Keep aligned with `shared/utils/order-assignment-defaults.ts`. */
export const DEFAULT_ASSIGNED_TO = {
  kitchenId: "auto",
  deliveryId: ""
} as const;

function pickDeliveryFromStaffDocs(docs: QueryDocumentSnapshot[], maxActive: number): string | null {
  type Row = { id: string; online: boolean; activeOrders: number };
  const rows: Row[] = docs.map((d) => {
    const data = d.data() as { online?: boolean; activeOrders?: number };
    return {
      id: d.id,
      online: data.online === true,
      activeOrders: Number(data.activeOrders ?? 0)
    };
  });
  const withCapacity = rows.filter((r) => r.activeOrders < maxActive);
  withCapacity.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.activeOrders - b.activeOrders;
  });
  if (withCapacity.length > 0) return withCapacity[0].id;
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.activeOrders - b.activeOrders);
  return rows[0].id;
}

/**
 * Picks a delivery agent: prefer `staff` (delivery_boy) with capacity, prefer online,
 * then `users` with role `delivery` or `delivery_boy` (approved not false).
 */
export async function selectAvailableDeliveryAgentId(db: Firestore): Promise<string | null> {
  const maxActive = Number(process.env.MAX_ACTIVE_DELIVERIES ?? 3);

  const staffSnap = await db.collection("staff").where("role", "==", "delivery_boy").get();
  const fromStaff = pickDeliveryFromStaffDocs(staffSnap.docs, maxActive);
  if (fromStaff) return fromStaff;

  const roles = ["delivery", "delivery_boy"] as const;
  for (const role of roles) {
    const usersSnap = await db.collection("users").where("role", "==", role).limit(50).get();
    for (const doc of usersSnap.docs) {
      const data = doc.data() as { approved?: boolean; isActive?: boolean };
      if (data.approved === false) continue;
      if (data.isActive === false) continue;
      return doc.id;
    }
  }

  return null;
}

/**
 * When an order becomes `ready`, assign the first available delivery agent (delivery orders only).
 * Idempotent: skips if `assignedTo.deliveryId` or legacy delivery ids already set.
 */
export async function assignDeliveryAgentWhenOrderReady(db: Firestore, orderId: string): Promise<void> {
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;

  const raw = orderSnap.data() as {
    orderType?: string;
    status?: string;
    assignedTo?: { kitchenId?: string; deliveryId?: string };
    deliveryBoyId?: string;
    deliveryPartnerId?: string;
  };

  if (String(raw.orderType ?? "").toLowerCase() !== "delivery") return;

  const existingDelivery = [
    raw.assignedTo?.deliveryId,
    raw.deliveryBoyId,
    raw.deliveryPartnerId
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .find(Boolean);
  if (existingDelivery) return;

  const agentId = await selectAvailableDeliveryAgentId(db);
  if (!agentId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[autoStaffAssignment] No delivery agent available for order ${orderId}`);
    }
    return;
  }

  const kitchenId = raw.assignedTo?.kitchenId ?? DEFAULT_ASSIGNED_TO.kitchenId;
  const nowIso = new Date().toISOString();

  const staffRef = db.collection("staff").doc(agentId);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists) {
    const cur = Number(staffSnap.data()?.activeOrders ?? 0);
    await staffRef.update({ activeOrders: cur + 1 });
  }

  const assignmentRef = db.collection("delivery_assignments").doc();
  await assignmentRef.set({
    id: assignmentRef.id,
    orderId,
    deliveryBoyId: agentId,
    status: "assigned",
    assignedAt: nowIso,
    updatedAt: nowIso,
    source: "auto_ready"
  });

  await orderRef.set(
    {
      assignedTo: {
        kitchenId,
        deliveryId: agentId
      },
      deliveryPartnerId: agentId,
      deliveryBoyId: agentId,
      updatedAt: nowIso
    },
    { merge: true }
  );

  await syncDeliveryTrackingDoc(orderId, {
    deliveryBoyId: agentId,
    assignmentId: assignmentRef.id,
    status: "assigned",
    updatedAt: nowIso
  });
}
