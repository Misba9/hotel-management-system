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
    <div className="min-h-screen bg-surface bg-mesh-dark">
      <AnimatePresence>
        {mobileOpen ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-surface-raised/95 shadow-glass backdrop-blur-xl transition-all duration-300 md:static md:z-0",
            collapsed ? "w-[4.5rem]" : "w-[min(17rem,88vw)] md:w-64",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
            <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl accent-gradient shadow-glow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              {!collapsed ? (
                <div className="leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">NFJC</span>
                  <span className="block text-base font-bold text-white">Command Center</span>
                </div>
              ) : null}
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navGroups.map((group) => {
              const items = visibleNav.filter((n) => n.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="mb-2">
                  {!collapsed ? (
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/25">
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
                        className={cn(
                          "group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-brand-muted text-brand-primary shadow-glow-sm"
                            : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-primary" />
                        ) : null}
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                            active ? "text-brand-primary" : "text-white/50"
                          )}
                        />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="hidden border-t border-white/[0.06] p-3 md:block">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-center rounded-xl border border-white/[0.08] py-2 text-xs text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            >
              {collapsed ? "→" : "← Collapse"}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface/80 backdrop-blur-xl">
            <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
              <button
                type="button"
                className="inline-flex shrink-0 rounded-xl p-2 text-white/60 transition hover:bg-white/5 hover:text-white md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <AlignJustify className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
                <p className="hidden truncate text-xs text-white/40 sm:block">Operations command center · Realtime</p>
              </div>

              <div className="hidden max-w-sm flex-1 lg:block">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input placeholder="Search orders, customers, menu…" className="pl-9" readOnly />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <NotificationBell onClick={() => setNotificationsOpen(true)} count={3} />

                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg accent-gradient text-sm font-bold text-white shadow-glow-sm">
                    {initial}
                  </span>
                  <div className="hidden min-w-0 max-w-[140px] lg:block">
                    <p className="truncate text-xs font-semibold text-white" title={email || undefined}>
                      {email || "Admin"}
                    </p>
                    <p className="text-[10px] capitalize text-white/40">{role ?? "Administrator"}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/5 disabled:opacity-50 sm:text-sm"
                >
                  {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  <span className="hidden lg:inline">{loggingOut ? "…" : "Log out"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 sm:p-6 lg:p-8 md:pb-8">{children}</main>
        </div>
      </div>

      <MobileBottomNav />
      <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
