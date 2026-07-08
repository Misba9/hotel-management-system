"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlignJustify, Loader2, LogOut, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { adminNav, pageTitleForPath } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { NotificationBell, NotificationCenter } from "@/components/admin/notification-center";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { ThemeSwitcher } from "../../../../shared/theme/react/ThemeSwitcher";

type Props = {
  children: ReactNode;
};

const navGroups = [
  { key: "main", label: "Operations" },
  { key: "business", label: "Business" },
  { key: "system", label: "System" }
] as const;

export function AdminDashboardShell({ children }: Props) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { user, logout, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const email = user?.email ?? "";
  const initial = email.trim() ? email.trim().charAt(0).toUpperCase() : "?";
  const title = pageTitleForPath(pathname);
  const visibleNav = adminNav.filter((item) => !item.adminOnly || role === "admin");

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-theme-background">
      <AnimatePresence>
        {mobileOpen ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-theme-overlay backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <aside
        className={cn(
          "theme-sidebar fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden shadow-glass backdrop-blur-xl transition-all duration-200",
          collapsed ? "w-[4.5rem]" : "w-[min(17rem,88vw)] md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-theme-border px-4">
            <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl accent-gradient shadow-glow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              {!collapsed ? (
                <div className="leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">NFJC</span>
                  <span className="block text-base font-bold text-theme-text-primary">Command Center</span>
                </div>
              ) : null}
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-theme-text-secondary transition hover:bg-theme-hover hover:text-theme-text-primary md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
            {navGroups.map((group) => {
              const items = visibleNav.filter((n) => n.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="mb-3">
                  {!collapsed ? (
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-theme-text-disabled">
                      {group.label}
                    </p>
                  ) : null}
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.match(pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={item.label}
                        className={cn("theme-nav-item mb-1", active && "active")}
                      >
                        <Icon className="transition-transform duration-200 group-hover:scale-105" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="hidden border-t border-theme-border p-4 md:block">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-center rounded-xl border border-theme-border py-2.5 text-xs text-theme-text-secondary transition hover:bg-theme-hover hover:text-theme-text-primary"
            >
              {collapsed ? "→" : "← Collapse"}
            </button>
          </div>
        </aside>

      <div
        className={cn(
          "flex h-screen min-w-0 flex-col transition-all duration-200",
          collapsed ? "md:pl-[4.5rem]" : "md:pl-64"
        )}
      >
          <header className="z-30 shrink-0 border-b border-theme-border bg-theme-surface/95 shadow-glass backdrop-blur-xl">
            <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
              <button
                type="button"
                className="inline-flex shrink-0 rounded-xl p-2 text-theme-text-secondary transition hover:bg-theme-hover hover:text-theme-text-primary md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <AlignJustify className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold text-theme-text-primary sm:text-lg">{title}</h1>
                <p className="hidden truncate text-xs text-theme-text-secondary sm:block">
                  Operations command center · Realtime
                </p>
              </div>

              <div className="hidden max-w-sm flex-1 lg:block">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-disabled" />
                  <Input placeholder="Search orders, customers, menu…" className="admin-search-input pl-9" readOnly />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <ThemeSwitcher variant="compact" />
                <NotificationBell onClick={() => setNotificationsOpen(true)} count={3} />

                <div className="flex items-center gap-2 rounded-xl border border-theme-border bg-theme-card py-1 pl-1 pr-2 shadow-glass transition hover:shadow-card">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg accent-gradient text-sm font-bold text-theme-text-primary shadow-glow-sm">
                    {initial}
                  </span>
                  <div className="hidden min-w-0 max-w-[140px] lg:block">
                    <p className="truncate text-xs font-semibold text-theme-text-primary" title={email || undefined}>
                      {email || "Admin"}
                    </p>
                    <p className="text-[10px] capitalize text-theme-text-secondary">{role ?? "Administrator"}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-xs font-semibold text-theme-text-secondary shadow-glass transition hover:bg-theme-hover hover:text-theme-text-primary disabled:opacity-50 sm:text-sm"
                >
                  {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  <span className="hidden lg:inline">{loggingOut ? "…" : "Log out"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto space-y-6 p-4 pb-24 sm:p-6 lg:p-8 md:pb-8">{children}</main>
        </div>

      <MobileBottomNav />
      <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
