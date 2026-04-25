import type { Href } from "expo-router";

import type { StaffRoleId } from "../constants/staff-roles";

/**
 * Role home URLs. Each role uses its own path prefix so routes stay unique in Expo Router
 * (e.g. `/waiter` vs `/kitchen/orders`).
 *
 * Product docs may call the staff directory `staffUsers`; Firestore uses `staff_users`.
 */
export function roleHomeHref(role: StaffRoleId | null): Href {
  if (!role) return "/login";
  switch (role) {
    case "waiter":
      return "/waiter";
    case "kitchen":
      return "/kitchen/orders";
    case "cashier":
      return "/cashier/billing";
    case "delivery":
      return "/delivery/deliveries";
    case "manager":
    case "admin":
      return "/manager/dashboard";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/** Top segment for the signed-in role shell (matches first URL segment). */
export function roleRoutePrefix(role: StaffRoleId): string {
  switch (role) {
    case "waiter":
      return "waiter";
    case "kitchen":
      return "kitchen";
    case "cashier":
      return "cashier";
    case "delivery":
      return "delivery";
    case "manager":
    case "admin":
      return "manager";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
