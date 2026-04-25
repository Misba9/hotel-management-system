/**
 * Legacy fine-grained permission strings (e.g. from Firestore `roles_permissions`).
 * Screen access should use `lib/rbac.ts` → `hasPermission(role, feature)` or `useAuthStore` + route guards.
 */
import type { StaffRoleId } from "../constants/staff-roles";

export type StaffSession = {
  role: StaffRoleId;
  permissions: string[];
};

export function checkPermission(session: StaffSession | null, permission: string): boolean {
  if (!session?.permissions?.length) return false;
  if (session.permissions.includes("all")) return true;
  return session.permissions.includes(permission);
}
