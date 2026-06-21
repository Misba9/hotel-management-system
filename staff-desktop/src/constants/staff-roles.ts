import type { StaffAppRole } from "@shared/utils/staff-access-control";
import { STAFF_APP_ROLES } from "@shared/utils/staff-access-control";

/** Same as {@link StaffAppRole} — `staff_users.role` / `users/{uid}.role`. */
export type StaffRoleId = StaffAppRole;

export const STAFF_ROLE_IDS: StaffRoleId[] = [...STAFF_APP_ROLES];

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRoleId, string[]> = {
  admin: ["view_orders", "update_status", "manage_staff"],
  manager: ["view_orders", "update_status"],
  cashier: ["view_orders", "billing", "payments"],
  kitchen: ["view_orders", "mark_prepared"],
  delivery: ["view_orders", "delivery"],
  waiter: ["view_orders", "waiter_table"]
};
