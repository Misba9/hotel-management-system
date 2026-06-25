import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { moduleLinksForRole } from "@/lib/role-routes";
import { RoleBadge, SyncStatusBadge } from "./SyncStatusBadge";

const SIDEBAR_LINKS = [
  { path: "/cashier", label: "Cashier", icon: "🧾", roles: ["cashier", "manager", "admin"] as const },
  { path: "/kitchen", label: "Kitchen", icon: "👨‍🍳", roles: ["kitchen", "manager", "admin"] as const },
  { path: "/waiter", label: "Tables", icon: "🪑", roles: ["waiter", "manager", "admin"] as const },
  { path: "/orders", label: "Orders", icon: "📦", roles: ["cashier", "manager", "admin"] as const },
  { path: "/manager", label: "Dashboard", icon: "📊", roles: ["manager", "admin"] as const },
  { path: "/settings", label: "Settings", icon: "⚙️", roles: ["cashier", "kitchen", "waiter", "manager", "admin"] as const }
];

type DesktopAppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onLogout?: () => void;
  extraActions?: ReactNode;
  hideSidebar?: boolean;
};

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-theme-text-secondary">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

export function DesktopAppShell({
  title,
  subtitle,
  children,
  onLogout,
  extraActions,
  hideSidebar = false
}: DesktopAppShellProps) {
  const { role, profile } = useAuth();
  const { mode, toggle } = useTheme();
  const location = useLocation();
  const { status } = useOfflineSync();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const links = SIDEBAR_LINKS.filter((l) => role && (l.roles as readonly string[]).includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-theme-background">
      {!hideSidebar ? (
        <aside
          className={`theme-sidebar flex shrink-0 flex-col transition-all ${
            sidebarCollapsed ? "w-[68px]" : "w-[220px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-theme-border px-4 py-4">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-theme-primary">Nausheen Staff</p>
                <p className="text-[10px] text-theme-text-secondary">Desktop POS</p>
              </div>
            ) : (
              <span className="text-xl">🍍</span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-1.5 text-theme-text-secondary hover:bg-theme-hover"
              title="Toggle sidebar"
            >
              {sidebarCollapsed ? "»" : "«"}
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-2">
            {links.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  title={link.label}
                  className={`theme-nav-item min-h-[44px] ${active ? "active bg-theme-primary text-white shadow-md" : ""}`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {!sidebarCollapsed ? <span>{link.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-theme-border bg-theme-surface px-6 py-3 shadow-sm">
          <div>
            <h1 className="text-lg font-extrabold text-theme-text-primary">{title}</h1>
            <p className="text-sm text-theme-text-secondary">
              {subtitle ?? `Branch · ${profile?.name ?? "Staff"}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveClock />
            <span className="hidden rounded-full bg-theme-success-muted px-3 py-1 text-xs font-bold text-theme-success lg:inline">
              Shift Open
            </span>
            <SyncStatusBadge status={status} />
            <RoleBadge />
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg border border-theme-border bg-theme-hover px-3 py-2 text-xs font-bold text-theme-text-secondary hover:text-theme-primary"
              title="Toggle theme"
            >
              {mode === "dark" ? "☀️" : "🌙"}
            </button>
            {extraActions}
            {onLogout ? (
              <button
                type="button"
                onClick={() => void onLogout()}
                className="min-h-[44px] rounded-lg border-2 border-theme-danger/40 px-5 py-2 text-sm font-bold text-theme-danger hover:bg-theme-danger-muted"
              >
                Logout
              </button>
            ) : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** @deprecated Use DesktopAppShell */
export { DesktopAppShell as AppShell };
