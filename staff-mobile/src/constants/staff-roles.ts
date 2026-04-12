/** Aligned with admin `staff_users.role` and backend role strings. */
export type StaffRoleId = "admin" | "manager" | "cashier" | "kitchen" | "delivery" | "waiter";

export const STAFF_ROLE_IDS: StaffRoleId[] = ["admin", "manager", "cashier", "kitchen", "delivery", "waiter"];

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRoleId, string[]> = {
  admin: ["all", "view_orders", "update_status", "manage_staff", "view_analytics"],
  /** Narrower than admin: operational dashboard + orders (no manage_staff / full analytics in app RBAC). */
  manager: ["view_orders", "update_status"],
  cashier: ["view_orders", "billing", "payments"],
  kitchen: ["view_orders", "mark_prepared"],
  delivery: ["view_orders", "delivery"],
  waiter: ["view_orders", "waiter_table"]
};
