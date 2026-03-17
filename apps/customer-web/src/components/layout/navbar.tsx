"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Search, ShoppingBag, Sun, UserCircle2 } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { useTheme } from "@/components/providers/theme-provider";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/orders", label: "Orders" },
  { href: "/about", label: "About" }
];

export function Navbar() {
  const pathname = usePathname();
  const { count, openCart } = useCart();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 md:text-base">
          <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-2 py-1 text-xs text-white">NF</span>
          <span className="hidden sm:inline dark:text-orange-300">Nausheen Fruits</span>
        </Link>
        <div className="hidden items-center gap-5 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition ${
                pathname === link.href
                  ? "font-semibold text-orange-600"
                  : "text-slate-600 hover:text-orange-600 dark:text-slate-300 dark:hover:text-orange-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/menu"
            aria-label="Search menu"
            className="rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className="rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            aria-label="Open cart"
            onClick={openCart}
            className="relative rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
          >
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-1.5 text-[10px] text-white">
                {count}
              </span>
            )}
          </button>
          <Link
            href="/profile"
            aria-label="Profile avatar"
            className="rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
          >
            <UserCircle2 className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
