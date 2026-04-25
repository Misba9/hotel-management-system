import { useMemo } from "react";

import type { StaffProfile } from "../services/staffUsers";
import { useAuthStore } from "../../store/useAuthStore";

export type { StaffProfile };

/** Legacy gate shape for hooks that predate Zustand auth. */
export type StaffGate = "active" | "pending" | "inactive" | "needs_assignment";

/**
 * Compatibility shim: prefer `useAuthStore` in new code.
 * Maps Zustand session to the old `{ user, staff, loading, gate, signOutUser }` shape.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const authReady = useAuthStore((s) => s.authReady);

  const staff = useMemo(() => {
    if (!user || !profile) return null;
    return {
      uid: user.uid,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      isActive: true as const
    };
  }, [user, profile]);

  let gate: StaffGate = "pending";
  if (authReady && user && isAuthenticated && profile) gate = "active";
  else if (authReady && user && !isAuthenticated) gate = "inactive";

  return {
    user,
    staff,
    loading,
    gate,
    signOutUser: logout
  };
}
