/**
 * Staff directory + RBAC — Firestore `staff_users/{uid}` where document id === Firebase Auth UID.
 * Implementation: `staffUsers.ts` (TypeScript).
 */
export {
  getStaffUser,
  getStaffProfile,
  ensurePendingStaffProfile,
  ensureStaffProfileDocument,
  ensureStaffProfileAfterLogin,
  resolveStaffSession,
  isPendingRole
} from "./staffUsers";
