import type { StaffRoleId } from "../constants/staff-roles";

/**
 * Fine-grained permissions (Firestore `staff_users.role` maps to these).
 * Legacy screen keys still work via {@link normalizeToPermission}.
 */
export type StaffPermission =
  | "manage_staff"
  | "view_orders"
  | "create_order"
  | "prepare_order"
  | "deliver_order"
  | "waiter_table";

/** Legacy UI feature keys — normalized to {@link StaffPermission} for checks. */
export type StaffFeature =
  | StaffPermission
  | "dashboard"
  | "orders"
  | "analytics"
  | "billing"
  | "kitchen_orders"
  | "delivery";

const LEGACY_TO_PERMISSION: Partial<Record<string, StaffPermission>> = {
  dashboard: "view_orders",
  orders: "view_orders",
  analytics: "view_orders",
  billing: "create_order",
  kitchen_orders: "prepare_order",
  delivery: "deliver_order",
  waiter_table: "waiter_table"
};

/** Role → permissions. Navigation is enforced in {@link AppNavigator} (one root screen per role). */
const ROLE_PERMISSIONS: Record<StaffRoleId, readonly StaffPermission[]> = {
  /** Same order visibility as manager; analytics tab enabled in manager navigator (see manager-tabs). */
  admin: ["view_orders", "manage_staff"],
  /** Dashboard + orders only (see manager tabs); no in-app analytics tab. */
  manager: ["view_orders"],
  cashier: ["create_order"],
  kitchen: ["prepare_order"],
  delivery: ["deliver_order"],
  waiter: ["waiter_table"]
};

const EMPTY: readonly StaffPermission[] = [];

export function normalizeToPermission(feature: StaffFeature | StaffPermission): StaffPermission {
  const mapped = LEGACY_TO_PERMISSION[feature as string];
  if (mapped) return mapped;
  return feature as StaffPermission;
}

/**
 * Whether `role` may perform `feature` (accepts legacy {@link StaffFeature} names).
 */
export function hasPermission(role: StaffRoleId, feature: StaffFeature | StaffPermission): boolean {
  const p = normalizeToPermission(feature);
  const allowed = ROLE_PERMISSIONS[role] ?? EMPTY;
  return allowed.includes(p);
}

export function permissionsForRole(role: StaffRoleId): readonly StaffPermission[] {
  return ROLE_PERMISSIONS[role] ?? EMPTY;
}

/** @deprecated Use {@link permissionsForRole} */
export function featuresForRole(role: StaffRoleId): readonly StaffPermission[] {
  return permissionsForRole(role);
}
