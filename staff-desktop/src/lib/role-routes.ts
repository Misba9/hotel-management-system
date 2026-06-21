import type { StaffAppRole } from "@shared/utils/staff-access-control";

export type StaffDesktopRoute =
  | "/login"
  | "/cashier"
  | "/kitchen"
  | "/waiter"
  | "/waiter/order/:tableId"
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
    case "waiter":
      return "/waiter";
    case "manager":
    case "admin":
      return "/manager";
    case "delivery":
      return "/waiter";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function rolesAllowedForPath(path: StaffDesktopRoute): StaffAppRole[] {
  switch (path) {
    case "/cashier":
      return ["cashier", "manager", "admin"];
    case "/kitchen":
      return ["kitchen", "manager", "admin"];
    case "/waiter":
      return ["waiter", "delivery", "manager", "admin"];
    case "/orders":
      return ["cashier", "manager", "admin"];
    case "/profile":
      return ["cashier", "kitchen", "waiter", "delivery", "manager", "admin"];
    case "/manager":
      return ["manager", "admin"];
    case "/settings":
      return ["cashier", "kitchen", "waiter", "delivery", "manager", "admin"];
    case "/login":
      return ["cashier", "kitchen", "waiter", "delivery", "manager", "admin"];
    default:
      return [];
  }
}

export function roleLabel(role: StaffAppRole): string {
  const labels: Record<StaffAppRole, string> = {
    admin: "Admin",
    manager: "Manager",
    kitchen: "Kitchen",
    cashier: "Cashier",
    waiter: "Waiter",
    delivery: "Delivery"
  };
  return labels[role];
}

export function moduleLinksForRole(role: StaffAppRole): Array<{ path: StaffDesktopRoute; label: string }> {
  const all = [
    { path: "/cashier" as const, label: "Cashier", roles: ["cashier", "manager", "admin"] as StaffAppRole[] },
    { path: "/kitchen" as const, label: "Kitchen", roles: ["kitchen", "manager", "admin"] as StaffAppRole[] },
    { path: "/waiter" as const, label: "Waiter", roles: ["waiter", "delivery", "manager", "admin"] as StaffAppRole[] },
    { path: "/manager" as const, label: "Manager", roles: ["manager", "admin"] as StaffAppRole[] }
  ];
  return all.filter((entry) => entry.roles.includes(role)).map(({ path, label }) => ({ path, label }));
}
