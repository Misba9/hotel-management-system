import type { StaffRoleId } from "@/constants/staff-roles";
import { resolveOrderSource } from "@/lib/pos/order-source";
import type { WorkflowStatus } from "@/lib/pos/order-workflow-status";
import type { StaffOrderRow } from "@/services/orders";

function isPrivileged(role: StaffRoleId): boolean {
  return role === "admin" || role === "manager";
}

export function canAcceptOrder(role: StaffRoleId): boolean {
  return role === "cashier" || isPrivileged(role);
}

export function canRejectOrder(role: StaffRoleId): boolean {
  return role === "cashier" || isPrivileged(role);
}

export function canPrintBill(role: StaffRoleId): boolean {
  return role === "cashier" || isPrivileged(role);
}

export function canCompleteOrder(role: StaffRoleId): boolean {
  return role === "cashier" || isPrivileged(role);
}

export function canMarkPreparing(role: StaffRoleId): boolean {
  return role === "kitchen" || isPrivileged(role);
}

export function canMarkReady(role: StaffRoleId): boolean {
  return role === "kitchen" || isPrivileged(role);
}

function isAggregatorOrder(order?: StaffOrderRow): boolean {
  if (!order) return false;
  const src = resolveOrderSource(order);
  return src === "swiggy" || src === "zomato";
}

export function allowedActionsForStatus(
  role: StaffRoleId,
  status: WorkflowStatus,
  order?: StaffOrderRow
): Array<"accept" | "reject" | "preparing" | "ready" | "print_bill" | "complete" | "pay"> {
  const actions: Array<"accept" | "reject" | "preparing" | "ready" | "print_bill" | "complete" | "pay"> = [];

  if (status === "new") {
    if (canAcceptOrder(role)) actions.push("accept");
    if (canRejectOrder(role)) actions.push("reject");
  }
  if (status === "accepted" && canMarkPreparing(role)) actions.push("preparing");
  if (status === "preparing" && canMarkReady(role)) actions.push("ready");
  if (status === "ready") {
    if (canPrintBill(role)) actions.push("print_bill");
    if (canCompleteOrder(role)) {
      if (isAggregatorOrder(order)) {
        actions.push("complete");
      } else {
        actions.push("pay");
      }
    }
  }
  if (status === "accepted" || status === "preparing") {
    if (canPrintBill(role)) actions.push("print_bill");
  }

  return actions;
}
