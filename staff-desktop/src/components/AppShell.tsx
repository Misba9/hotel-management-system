import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { moduleLinksForRole } from "@/lib/role-routes";
import { RoleBadge, SyncStatusBadge } from "./SyncStatusBadge";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onLogout?: () => void;
  extraActions?: React.ReactNode;
};

export function AppShell({ title, subtitle, children, onLogout, extraActions }: AppShellProps) {
  const { role, profile } = useAuth();
  const location = useLocation();
  const { status } = useOfflineSync();
  const links = role ? moduleLinksForRole(role) : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">
            {subtitle ?? `Nausheen Staff Desktop · ${profile?.name ?? "Staff"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusBadge status={status} />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  location.pathname === link.path
                    ? "bg-brand-teal text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/settings"
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                location.pathname === "/settings"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Settings
            </Link>
          </nav>
          <RoleBadge />
          {extraActions}
          {onLogout ? (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="min-h-[44px] rounded-lg border-2 border-red-300 px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
