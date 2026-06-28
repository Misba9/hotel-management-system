import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import type { ManagerNavItem, ManagerNavKey } from "./types";

type ManagerModuleShellProps = {
  navItems: ManagerNavItem[];
  activeKey: ManagerNavKey;
  onNavigate: (key: ManagerNavKey) => void;
  onLogout: () => void;
  children: ReactNode;
  pendingNotifications: number;
};

function ThemeSwitch() {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-text-secondary transition hover:bg-theme-hover hover:text-theme-text-primary"
      title="Toggle color mode"
    >
      {mode === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

export function ManagerModuleShell({
  navItems,
  activeKey,
  onNavigate,
  onLogout,
  children,
  pendingNotifications
}: ManagerModuleShellProps) {
  const { profile } = useAuth();
  const { status } = useOfflineSync();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel = useMemo(
    () => navItems.find((item) => item.key === activeKey)?.label ?? "Dashboard",
    [activeKey, navItems]
  );

  return (
    <div className="flex min-h-screen bg-theme-background text-theme-text-primary">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-theme-overlay/70 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[19rem] flex-col border-r border-theme-border bg-theme-surface shadow-glass transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
        <div className="border-b border-theme-border px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-theme-primary">Fruit Hotel</p>
          <h1 className="mt-1 text-xl font-black">Manager Console</h1>
          <p className="text-xs text-theme-text-secondary">Operational command center</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.key === activeKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.key);
                  setMobileOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  active
                    ? "bg-theme-primary text-white shadow-glow-sm"
                    : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text-primary"
                ].join(" ")}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                  <span className={active ? "text-[11px] text-white/80" : "text-[11px] text-theme-text-disabled"}>
                    {item.description}
                  </span>
                </span>
                {item.key === "notifications" && pendingNotifications > 0 ? (
                  <span className="ml-auto rounded-full bg-theme-danger px-2 py-0.5 text-[11px] font-bold text-white">
                    {pendingNotifications}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-theme-border p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center rounded-xl border border-theme-danger/30 bg-theme-danger-muted px-3 py-2.5 text-sm font-semibold text-theme-danger transition hover:brightness-95"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-theme-border bg-theme-surface/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="rounded-xl border border-theme-border bg-theme-hover px-3 py-2 text-sm font-semibold md:hidden"
              aria-label="Open sidebar"
            >
              Menu
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-theme-text-disabled">Current section</p>
              <h2 className="truncate text-lg font-bold">{activeLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitch />
              <div className="rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-xs">
                <p className="font-semibold">{profile?.name ?? "Manager"}</p>
                <p className="text-theme-text-secondary">
                  Sync queue: <span className="font-semibold">{status.pendingCount}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-theme-text-disabled">
            <Link className="underline hover:text-theme-primary" to="/profile">
              Profile
            </Link>
            <span className="mx-2">•</span>
            <Link className="underline hover:text-theme-primary" to="/settings">
              App Settings
            </Link>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
