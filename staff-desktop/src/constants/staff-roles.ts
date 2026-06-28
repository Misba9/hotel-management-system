import type { StaffAppRole } from "@shared/utils/staff-access-control";

/** Same as {@link StaffAppRole} — `staff_users.role` / `users/{uid}.role`. */
export type StaffRoleId = StaffAppRole;

export const STAFF_OPERATIONAL_ROLE_IDS = ["manager", "cashier", "kitchen"] as const;
export type StaffOperationalRoleId = (typeof STAFF_OPERATIONAL_ROLE_IDS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Partial<Record<StaffRoleId, string[]>> = {
  manager: ["view_orders", "update_status"],
  cashier: ["view_orders", "billing", "payments"],
  kitchen: ["view_orders", "mark_prepared"]
};
