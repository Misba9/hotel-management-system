"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlignJustify,
  BarChart3,
  Bell,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Search,
  UserCog,
  Users,
  X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (p: string) => boolean;
  /** Only show for users with `admin` app role (staff management). */
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p: string) => p === "/admin" || p === "/admin/"
  },
  { href: "/admin/orders", label: "Orders", icon: Package, match: (p: string) => p.startsWith("/admin/orders") },
  { href: "/admin/menu", label: "Menu", icon: Menu, match: (p: string) => p.startsWith("/admin/menu") },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
    match: (p: string) => p.startsWith("/admin/customers")
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/admin/analytics")
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: UserCog,
    match: (p: string) => p.startsWith("/admin/staff"),
    adminOnly: true
  }
];

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/orders")) return "Orders";
  if (pathname.startsWith("/admin/menu")) return "Menu";
  if (pathname.startsWith("/admin/customers")) return "Customers";
  if (pathname.startsWith("/admin/analytics")) return "Analytics";
  if (pathname.startsWith("/admin/staff")) return "Staff";
  return "Dashboard";
}

type Props = {
  children: ReactNode;
};

export function AdminDashboardShell({ children }: Props) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { user, logout, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const email = user?.email ?? "";
  const initial = email.trim() ? email.trim().charAt(0).toUpperCase() : "?";

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

  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Sidebar — fixed on mobile overlay, static from md */}
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-[min(17rem,88vw)] flex-col bg-gray-900 text-white shadow-xl transition-transform duration-200 ease-out md:static md:z-0 md:w-64 md:translate-x-0 md:shadow-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          ].join(" ")}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <Link href="/admin" className="flex flex-col leading-tight" onClick={() => setMobileOpen(false)}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400">NFJC</span>
              <span className="text-lg font-bold tracking-tight">Admin</span>
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {nav
              .filter((item) => !item.adminOnly || role === "admin")
              .map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-white/10 text-white shadow-md ring-1 ring-white/15"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <p className="text-[11px] leading-relaxed text-gray-500">Nausheen Fruits Juice Center</p>
            <p className="mt-1 text-[10px] text-gray-600">SaaS console</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
              <button
                type="button"
                className="inline-flex shrink-0 rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <AlignJustify className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-50">{title}</h1>
                <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
                  Manage orders, menu, and growth
                </p>
              </div>

              <div className="hidden max-w-xs flex-1 md:block">
                <label htmlFor="admin-search" className="sr-only">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="admin-search"
                    type="search"
                    placeholder="Search orders, customers…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                    readOnly
                    title="Connect search to your backend when ready"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-slate-900" />
                </button>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-1 pr-2 dark:border-slate-700 dark:bg-slate-800">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-sm font-bold text-white shadow-sm"
                    aria-hidden
                  >
                    {initial}
                  </span>
                  <div className="hidden min-w-0 max-w-[140px] sm:block">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100" title={email || undefined}>
                      {email || "Admin"}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Administrator</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
                >
                  {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" />}
                  <span className="hidden lg:inline">{loggingOut ? "…" : "Log out"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
