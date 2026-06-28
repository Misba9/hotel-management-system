"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mobileNavItems } from "@/config/navigation";

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-theme-border bg-theme-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-glass backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors duration-200",
                active ? "text-brand-primary" : "text-theme-text-secondary hover:text-theme-text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate text-[10px] font-medium">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
