"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun, UserCircle2 } from "lucide-react";
import { CartIconButton } from "@/components/cart/cart-icon-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavbarMenuSearch } from "@/components/layout/navbar-menu-search";
import { useCart } from "@/components/cart/cart-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/context/auth-context";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/orders", label: "Orders" },
  { href: "/about", label: "About" }
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, openCart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user, login, logout } = useAuth();
  const signedIn = Boolean(user);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:h-14 md:gap-3">
          <Link
            href="/"
            className="inline-flex min-w-0 shrink-0 items-center gap-2 text-sm font-bold text-orange-600 md:text-base lg:text-lg"
          >
            <span className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-2 py-1 text-xs text-white">
              NF
            </span>
            <span className="hidden truncate sm:inline dark:text-orange-300">Nausheen Fruits</span>
          </Link>

          <div className="hidden min-w-0 flex-1 md:block md:max-w-xl">
            <NavbarMenuSearch />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Toggle dark mode"
              onClick={toggleTheme}
              className="rounded-full border border-slate-200 p-2 transition-all duration-200 dark:border-slate-700 dark:text-slate-200"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {signedIn ? <NotificationBell /> : null}
            <CartIconButton
              count={count}
              onClick={openCart}
              className="rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
            />
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Profile menu"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
              >
                <UserCircle2 className="h-4 w-4" />
              </button>
              {profileOpen ? (
                <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {signedIn ? (
                    <>
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          setProfileOpen(false);
                          await logout();
                          router.push("/menu");
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        login();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Login
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-2 md:hidden">
          <NavbarMenuSearch />
        </div>

        <nav
          className="hidden items-center gap-6 border-t border-slate-100 pt-3 dark:border-slate-800 md:flex md:pt-3"
          aria-label="Main"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 text-sm transition-all duration-200 md:text-base ${
                pathname === link.href
                  ? "font-semibold text-orange-600"
                  : "text-slate-600 hover:text-orange-600 dark:text-slate-300 dark:hover:text-orange-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
