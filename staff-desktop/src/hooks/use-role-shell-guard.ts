import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { homePathForRole } from "@/lib/role-routes";
import type { StaffAppRole } from "@shared/utils/staff-access-control";

/** Redirect when authenticated user lacks role access to current shell. */
export function useRoleShellGuard(allowedRoles: StaffAppRole[]) {
  const { role, authReady, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady || !profile || !role) return;
    if (!allowedRoles.includes(role)) {
      navigate(homePathForRole(role), { replace: true });
    }
  }, [authReady, profile, role, allowedRoles, navigate]);
}
