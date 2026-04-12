/**
 * Canonical staff roles (Firestore `staff.role` + `roles_permissions` doc id).
 * Custom claims use `staffRoleToAuthClaim()` for Firebase Auth token `role`.
 */

export type StaffRoleId = "manager" | "waiter" | "kitchen";

export const STAFF_ROLE_IDS: StaffRoleId[] = ["manager", "waiter", "kitchen"];

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRoleId, string[]> = {
  manager: ["all", "view_orders", "update_status", "manage_staff", "view_analytics"],
  waiter: ["view_orders", "update_status"],
  kitchen: ["view_orders", "mark_prepared"]
};

export function staffRoleToAuthClaim(role: StaffRoleId): string {
  switch (role) {
    case "manager":
      return "manager";
    case "waiter":
      return "waiter";
    case "kitchen":
      return "kitchen_staff";
    default:
      return "waiter";
  }
}

export function staffRoleToUsersCollectionRole(role: StaffRoleId): string {
  return staffRoleToAuthClaim(role);
}
