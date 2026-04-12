/**
 * Helpers for the unified `orders` collection — tolerate legacy field names during rollout.
 */

export type UnifiedAssignedTo = {
  kitchenId: string;
  deliveryId: string;
};

export function emptyAssignedTo(): UnifiedAssignedTo {
  return { kitchenId: "", deliveryId: "" };
}

export function getAssignedTo(data: { assignedTo?: unknown } | null | undefined): UnifiedAssignedTo {
  const raw = data?.assignedTo;
  if (!raw || typeof raw !== "object") return emptyAssignedTo();
  const m = raw as Record<string, unknown>;
  const kitchenId =
    typeof m.kitchenId === "string"
      ? m.kitchenId
      : typeof m.kitchen === "string"
        ? m.kitchen
        : "";
  const deliveryId =
    typeof m.deliveryId === "string"
      ? m.deliveryId
      : typeof m.delivery === "string"
        ? m.delivery
        : "";
  return { kitchenId, deliveryId };
}

export function getOrderTotal(data: { total?: unknown; totalAmount?: unknown } | null | undefined): number {
  if (typeof data?.total === "number" && Number.isFinite(data.total)) return data.total;
  if (typeof data?.totalAmount === "number" && Number.isFinite(data.totalAmount)) return data.totalAmount;
  return 0;
}

/** Delivery assignee for queries — prefers unified `assignedTo.deliveryId`, then legacy top-level ids. */
export function getDeliveryAssigneeUid(data: Record<string, unknown> | undefined): string {
  if (!data) return "";
  const at = getAssignedTo(data);
  if (at.deliveryId) return at.deliveryId;
  if (typeof data.deliveryPartnerId === "string") return data.deliveryPartnerId;
  if (typeof data.deliveryBoyId === "string") return data.deliveryBoyId;
  return "";
}
