/**
 * `useAuth` — same as `useStaffAuth` (Firebase Auth + real-time `staff_users/{uid}`).
 */
export { useAuth } from "../context/AuthProvider";
export type { StaffProfile, StaffGate } from "../context/staff-auth-context";
