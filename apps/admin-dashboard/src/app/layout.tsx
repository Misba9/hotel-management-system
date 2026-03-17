import "./globals.css";
import { ReactNode } from "react";
import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/menu", label: "Menu" },
  { href: "/orders", label: "Orders" },
  { href: "/delivery", label: "Delivery" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/inventory", label: "Inventory" },
  { href: "/coupons", label: "Coupons" },
  { href: "/staff", label: "Staff" },
  { href: "/branches", label: "Branches" }
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grid min-h-screen grid-cols-[250px_1fr] bg-slate-50">
          <aside className="border-r bg-white p-4">
            <h1 className="mb-1 text-lg font-bold text-orange-600">NFJC Admin</h1>
            <p className="mb-6 text-xs text-slate-500">Nausheen Fruits Juice Center</p>
            <nav className="space-y-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-orange-50">
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
