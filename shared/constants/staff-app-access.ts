import type { StaffManagementRoleId } from "./staff-management-roles";
import type { StaffAppRole } from "../utils/staff-access-control";
import { normalizeStaffAppRole } from "../utils/staff-access-control";

export const STAFF_APP_PLATFORMS = ["desktop", "mobile"] as const;

export type StaffAppPlatform = (typeof STAFF_APP_PLATFORMS)[number];

/** Default login surfaces per role (overridable per user via `staff_users.allowedApps`). */
export const DEFAULT_ROLE_APP_ACCESS: Record<StaffManagementRoleId, readonly StaffAppPlatform[]> = {
  admin: ["desktop", "mobile"],
  manager: ["desktop", "mobile"],
  cashier: ["desktop"],
  kitchen: ["desktop", "mobile"],
  waiter: ["mobile"]
};

export function defaultAppsForRole(role: StaffManagementRoleId | StaffAppRole): StaffAppPlatform[] {
  const defaults = DEFAULT_ROLE_APP_ACCESS[role as StaffManagementRoleId];
  return defaults ? [...defaults] : ["desktop", "mobile"];
}

export function formatAppAccessLabel(apps: readonly StaffAppPlatform[]): string {
  const hasDesktop = apps.includes("desktop");
  const hasMobile = apps.includes("mobile");
  if (hasDesktop && hasMobile) return "Desktop + Mobile";
  if (hasDesktop) return "Desktop only";
  if (hasMobile) return "Mobile only";
  return "No access";
}

export function parseAllowedApps(
  raw: unknown,
  role: StaffManagementRoleId | StaffAppRole | null | undefined
): StaffAppPlatform[] {
  if (Array.isArray(raw)) {
    const apps = raw.filter((v): v is StaffAppPlatform => v === "desktop" || v === "mobile");
    if (apps.length > 0) return apps;
  }
  if (role) return defaultAppsForRole(role);
  return [];
}

export function canAccessStaffPlatform(
  platform: StaffAppPlatform,
  data: { allowedApps?: unknown; role?: unknown } | null | undefined
): boolean {
  if (!data) return false;
  const role = normalizeStaffAppRole(data.role);
  if (!role) return false;
  return parseAllowedApps(data.allowedApps, role).includes(platform);
}
