import type { StaffAppRole } from "./staff-access-control";

export const MANAGER_OPERATIONAL_PERMISSIONS = ["view_orders", "update_status"] as const;

export type ManagerOperationalPermission = (typeof MANAGER_OPERATIONAL_PERMISSIONS)[number];

export function isManagerRole(role: StaffAppRole | null | undefined): role is "manager" {
  return role === "manager";
}

export function hasManagerOperationalAccess(role: StaffAppRole | null | undefined): boolean {
  return isManagerRole(role);
}

export function isAdminRole(role: StaffAppRole | null | undefined): role is "admin" {
  return role === "admin";
}
