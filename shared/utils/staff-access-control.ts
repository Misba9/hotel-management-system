/**
 * Shared staff RBAC: read `users/{uid}` after login, enforce `approved` / `pendingApproval`,
 * normalize `role`, and map to each app’s home route.
 *
 * Firestore staff profile may also use `staff_users/{uid}` (mobile); web admin relies on
 * `users/{uid}` + optional Auth custom claims.
 */

export const STAFF_APP_ROLES = ["admin", "manager", "kitchen", "cashier", "waiter", "delivery"] as const;

export type StaffAppRole = (typeof STAFF_APP_ROLES)[number];

/** Subset of `users/{uid}` / token fields used for gating. */
export type StaffUsersDocFields = {
  role?: unknown;
  approved?: unknown;
  pendingApproval?: unknown;
};

export function normalizeStaffAppRole(raw: unknown): StaffAppRole | null {
  if (typeof raw !== "string") return null;
  const r = raw.trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "kitchen" || r === "kitchen_staff") return "kitchen";
  if (r === "cashier" || r === "counter") return "cashier";
  if (r === "waiter") return "waiter";
  if (r === "delivery" || r === "delivery_boy") return "delivery";
  return null;
}

/**
 * `staff_users.role` (and similar): includes `pending` before admin assigns a real role.
 */
export function normalizeStaffUsersRowRole(raw: unknown): StaffAppRole | "pending" | null {
  if (typeof raw !== "string") return null;
  const r = raw.trim().toLowerCase();
  if (r === "pending") return "pending";
  return normalizeStaffAppRole(raw);
}

/** True when `users/{uid}` explicitly denies app access. Missing doc does not block. */
export function usersDocBlocksStaffAccess(data: StaffUsersDocFields | null | undefined): boolean {
  if (data == null || typeof data !== "object") return false;
  if (data.pendingApproval === true) return true;
  if (data.approved === false) return true;
  return false;
}

export function resolveStaffRoleFromUsersDoc(data: StaffUsersDocFields | null | undefined): StaffAppRole | null {
  if (!data) return null;
  return normalizeStaffAppRole(data.role);
}

/**
 * Prefer `users/{uid}.role`; fall back to Auth custom claim (e.g. after admin sets claims).
 */
export function resolveStaffAppRole(
  usersDoc: StaffUsersDocFields | null | undefined,
  tokenClaimRole: unknown
): StaffAppRole | null {
  const fromDoc = resolveStaffRoleFromUsersDoc(usersDoc ?? undefined);
  if (fromDoc) return fromDoc;
  return normalizeStaffAppRole(tokenClaimRole);
}

/** React Navigation root route names (staff-mobile `AppNavigator`). */
export type StaffMobileRootRoute =
  | "AdminRoot"
  | "ManagerRoot"
  | "CashierRoot"
  | "KitchenRoot"
  | "DeliveryRoot"
  | "WaiterDashboard";

export function staffMobileRootRouteForRole(role: StaffAppRole): StaffMobileRootRoute {
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
      return "WaiterDashboard";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/**
 * Next.js admin-dashboard paths after login (`routeForRole`).
 * Cashier uses URL `/counter` for the existing counter page.
 */
export function staffWebHomePathForRole(role: StaffAppRole): string {
  switch (role) {
    case "admin":
    case "manager":
      return "/admin";
    case "kitchen":
      return "/kitchen";
    case "cashier":
      return "/counter";
    case "delivery":
      return "/delivery";
    case "waiter":
      return "/waiter";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
