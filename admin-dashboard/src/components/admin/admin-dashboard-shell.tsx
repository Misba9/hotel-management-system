"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlignJustify, LayoutDashboard, Menu, Package, X } from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/admin" || p === "/admin/" },
  { href: "/admin/menu", label: "Menu", icon: Menu, match: (p: string) => p.startsWith("/admin/menu") },
  { href: "/admin/orders", label: "Orders", icon: Package, match: (p: string) => p.startsWith("/admin/orders") }
] as const;

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/menu")) return "Menu";
  if (pathname.startsWith("/admin/orders")) return "Orders";
  return "Dashboard";
}

type Props = {
  children: ReactNode;
};

export function AdminDashboardShell({ children }: Props) {
  const pathname = usePathname() ?? "/admin";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-slate-200/80 bg-white shadow-lg transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-64 lg:translate-x-0 lg:shadow-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          ].join(" ")}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 lg:h-auto lg:flex-col lg:items-stretch lg:gap-1 lg:border-0 lg:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">NFJC</p>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Admin</h1>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3 lg:px-4">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-orange-50 text-brand-primary shadow-sm ring-1 ring-orange-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4 text-xs text-slate-400">Nausheen Fruits Juice Center</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <AlignJustify className="h-5 w-5" />
              </button>
              <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline">Signed in</span>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-orange-600 text-xs font-bold text-white">
                  A
                </span>
                <span className="text-sm font-medium text-slate-800">Admin</span>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
