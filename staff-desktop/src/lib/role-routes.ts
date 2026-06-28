import type { StaffAppRole } from "@shared/utils/staff-access-control";

export type StaffDesktopRoute =
  | "/login"
  | "/cashier"
  | "/kitchen"
  | "/orders"
  | "/manager"
  | "/profile"
  | "/settings";

export function homePathForRole(role: StaffAppRole): StaffDesktopRoute {
  switch (role) {
    case "cashier":
      return "/cashier";
    case "kitchen":
      return "/kitchen";
    case "manager":
      return "/manager";
    default: {
      return "/login";
    }
  }
}

export function rolesAllowedForPath(path: StaffDesktopRoute): StaffAppRole[] {
  switch (path) {
    case "/cashier":
      return ["cashier", "manager"];
    case "/kitchen":
      return ["kitchen", "manager"];
    case "/orders":
      return ["cashier", "manager"];
    case "/profile":
      return ["cashier", "kitchen", "manager"];
    case "/manager":
      return ["manager"];
    case "/settings":
      return ["cashier", "kitchen", "manager"];
    case "/login":
      return ["cashier", "kitchen", "manager"];
    default:
      return [];
  }
}

export function roleLabel(role: StaffAppRole): string {
  if (role === "manager") return "Manager";
  if (role === "kitchen") return "Kitchen";
  if (role === "cashier") return "Cashier";
  return "Not allowed on desktop";
}

export function moduleLinksForRole(role: StaffAppRole): Array<{ path: StaffDesktopRoute; label: string }> {
  const all = [
    { path: "/cashier" as const, label: "Cashier", roles: ["cashier", "manager"] as StaffAppRole[] },
    { path: "/kitchen" as const, label: "Kitchen", roles: ["kitchen", "manager"] as StaffAppRole[] },
    { path: "/manager" as const, label: "Dashboard", roles: ["manager"] as StaffAppRole[] },
    { path: "/orders" as const, label: "Orders", roles: ["cashier", "manager"] as StaffAppRole[] },
    { path: "/settings" as const, label: "Settings", roles: ["cashier", "kitchen", "manager"] as StaffAppRole[] }
  ];
  return all.filter((entry) => entry.roles.includes(role)).map(({ path, label }) => ({ path, label }));
}
