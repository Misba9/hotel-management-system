import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { homePathForRole, rolesAllowedForPath, type StaffDesktopRoute } from "@/lib/role-routes";

type RoleGuardProps = {
  path: StaffDesktopRoute;
  children: React.ReactNode;
};

export function RoleGuard({ path, children }: RoleGuardProps) {
  const { profile, role, loading, authReady } = useAuth();

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading session…
      </div>
    );
  }

  if (!profile || !role) {
    return <Navigate to="/login" replace />;
  }

  const allowed = rolesAllowedForPath(path);
  if (!allowed.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <>{children}</>;
}
