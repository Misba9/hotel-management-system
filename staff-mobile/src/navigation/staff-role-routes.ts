import type { StaffRoleId } from "../constants/staff-roles";

/**
 * Firestore: `staff_users/{uid}` where **document ID === Firebase Auth UID** (never email).
 *
 * Canonical fields:
 * - `uid` (string, mirrors document id)
 * - `email`, `name`
 * - `role`: admin | manager | kitchen | cashier | delivery | pending (+ waiter legacy)
 * - `isActive` (boolean)
 * - `createdAt` (timestamp)
 * - Optional: `pendingApproval` (legacy self-signup), `updatedAt`
 */
export const STAFF_USERS_COLLECTION = "staff_users" as const;

export type StaffAppRootRoute =
  | "AdminRoot"
  | "ManagerRoot"
  | "CashierRoot"
  | "KitchenRoot"
  | "DeliveryRoot"
  | "WaiterRoot"
  | "AccessDenied";

/** Role → root screen after login. */
export function rootRouteForStaffRole(role: StaffRoleId): StaffAppRootRoute {
  switch (role) {
    case "admin":
      return "AdminRoot";
    case "manager":
      return "ManagerRoot";
    case "cashier":
      return "CashierRoot";
    case "kitchen":
      return "KitchenRoot";
    case "delivery":
      return "DeliveryRoot";
    case "waiter":
      return "WaiterRoot";
  }
}
