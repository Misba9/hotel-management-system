"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MenuSquare, ReceiptText, ShoppingBag, User } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: MenuSquare },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/profile", label: "Profile", icon: User }
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/50 bg-white/90 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/90 md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center rounded-xl py-2 text-xs ${
                active
                  ? "bg-orange-50 text-orange-600 dark:bg-slate-800 dark:text-orange-300"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <Icon className="mb-1 h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
