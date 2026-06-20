import {
  BarChart3,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Menu,
  MonitorDot,
  Package,
  Plug,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Warehouse,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  adminOnly?: boolean;
  group?: "main" | "business" | "system";
};

export const adminNav: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/admin" || p === "/admin/",
    group: "main"
  },
  {
    href: "/admin/operations",
    label: "Operations",
    icon: MonitorDot,
    match: (p) => p.startsWith("/admin/operations"),
    group: "main"
  },
  {
    href: "/admin/pos",
    label: "POS",
    icon: ShoppingCart,
    match: (p) => p.startsWith("/admin/pos"),
    group: "main"
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: Package,
    match: (p) => p.startsWith("/admin/orders"),
    group: "main"
  },
  {
    href: "/admin/delivery",
    label: "Delivery Management",
    icon: Truck,
    match: (p) => p.startsWith("/admin/delivery"),
    group: "main"
  },
  {
    href: "/admin/menu",
    label: "Menu",
    icon: Menu,
    match: (p) => p.startsWith("/admin/menu"),
    group: "main"
  },
  {
    href: "/admin/tables",
    label: "Tables",
    icon: LayoutGrid,
    match: (p) => p.startsWith("/admin/tables"),
    group: "main"
  },
  {
    href: "/admin/kitchen",
    label: "Kitchen Display",
    icon: ChefHat,
    match: (p) => p.startsWith("/admin/kitchen"),
    group: "main"
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: Warehouse,
    match: (p) => p.startsWith("/admin/inventory"),
    group: "business"
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
    match: (p) => p.startsWith("/admin/customers"),
    group: "business"
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: UserCog,
    match: (p) => p.startsWith("/admin/staff"),
    adminOnly: true,
    group: "business"
  },
  {
    href: "/admin/finance",
    label: "Finance",
    icon: CreditCard,
    match: (p) => p.startsWith("/admin/finance"),
    group: "business"
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: BarChart3,
    match: (p) => p.startsWith("/admin/reports") || p.startsWith("/admin/analytics"),
    group: "business"
  },
  {
    href: "/admin/marketing",
    label: "Marketing",
    icon: Megaphone,
    match: (p) => p.startsWith("/admin/marketing"),
    group: "system"
  },
  {
    href: "/admin/integrations",
    label: "Integrations",
    icon: Plug,
    match: (p) => p.startsWith("/admin/integrations"),
    group: "system"
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p.startsWith("/admin/settings"),
    group: "system"
  }
];

export function pageTitleForPath(pathname: string): string {
  const item = adminNav.find((n) => n.match(pathname));
  if (item) return item.label;
  if (pathname.startsWith("/admin/staff/")) return "Staff Profile";
  return "Dashboard";
}

export const mobileNavItems = adminNav.filter((n) =>
  ["/admin", "/admin/orders", "/admin/operations", "/admin/pos", "/admin/menu"].includes(n.href)
);
