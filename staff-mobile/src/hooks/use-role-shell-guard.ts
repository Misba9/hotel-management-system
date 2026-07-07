import { useEffect } from "react";
import { useRouter } from "expo-router";

import type { StaffRoleId } from "../constants/staff-roles";
import { roleHomeHref } from "../lib/staff-role-home";
import { useAuthStore } from "../../store/useAuthStore";

/**
 * Keeps each role folder accessible only to allowed roles (Expo Router only).
 */
export function useRoleShellGuard(allowedRoles: readonly StaffRoleId[]) {
  const router = useRouter();
  const authReady = useAuthStore((s) => s.authReady);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const allowedRolesKey = allowedRoles.join("\0");

  useEffect(() => {
    if (!authReady || loading) return;
    if (!user || !isAuthenticated || !role) return;
    if (!allowedRoles.includes(role)) {
      router.replace(roleHomeHref(role));
    }
    // Stable key — inline `["waiter"]` literals must not retrigger this every render.
  }, [authReady, loading, user, isAuthenticated, role, allowedRolesKey, router]);
}
