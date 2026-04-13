import type { StaffMobileRootRoute } from "@shared/utils/staff-access-control";
import { staffMobileRootRouteForRole } from "@shared/utils/staff-access-control";
import type { StaffRoleId } from "../constants/staff-roles";

/**
 * Firestore: `staff_users/{uid}` where **document ID === Firebase Auth UID** (never email).
 *
 * Canonical fields:
 * - `uid` (string, mirrors document id)
 * - `email`, `name`
 * - `role`: admin | manager | kitchen | cashier | delivery | waiter | pending
 * - `isActive` (boolean)
 * - `createdAt` (timestamp)
 * - Optional: `pendingApproval` (legacy self-signup), `updatedAt`
 */
export const STAFF_USERS_COLLECTION = "staff_users" as const;

export type StaffAppRootRoute = StaffMobileRootRoute;

/** `gate` values that should show the pending-approval stack (not approved / needs role). */
export function isPendingApprovalGate(gate: string): boolean {
  return gate === "pending" || gate === "needs_assignment";
}

/**
 * Role → root screen after login (approved + active staff only).
 * Shared mapping: {@link staffMobileRootRouteForRole}.
 */
export function rootRouteForStaffRole(role: StaffRoleId): StaffAppRootRoute {
  return staffMobileRootRouteForRole(role);
}
