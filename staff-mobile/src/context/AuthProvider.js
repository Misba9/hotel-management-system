/**
 * App-wide auth + `staff_users/{uid}` profile (real-time).
 * Implementation lives in TypeScript; this file exposes the conventional `AuthProvider` / `useAuth` names.
 */
export { StaffAuthProvider as AuthProvider, useStaffAuth as useAuth } from "./staff-auth-context";
