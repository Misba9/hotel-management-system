/**
 * Roles for admin "Staff Management" (`staff_users` collection).
 * Maps to Firebase Auth custom claim `role` values used in Firestore rules.
 */
export const STAFF_MANAGEMENT_ROLE_IDS = [
  "admin",
  "manager",
  "cashier",
  "kitchen",
  "delivery"
] as const;

export type StaffManagementRoleId = (typeof STAFF_MANAGEMENT_ROLE_IDS)[number];

/** Self-serve mobile signup placeholder until an admin assigns a real role. */
export const STAFF_DIRECTORY_PLACEHOLDER_ROLE = "staff" as const;

export type StaffDirectoryRoleId = StaffManagementRoleId | typeof STAFF_DIRECTORY_PLACEHOLDER_ROLE;

export function staffManagementRoleToAuthClaim(role: StaffManagementRoleId): string {
  switch (role) {
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "cashier":
      return "cashier";
    case "kitchen":
      return "kitchen_staff";
    case "delivery":
      return "delivery_boy";
    default:
      return "cashier";
  }
}

/** Mirror field for `users` collection if you sync profiles there. */
export function staffManagementRoleToUsersField(role: StaffManagementRoleId): string {
  return staffManagementRoleToAuthClaim(role);
}

/** Human-readable labels + access hints for admin UI */
export const STAFF_ROLE_DESCRIPTIONS: Record<StaffManagementRoleId, string> = {
  admin: "Full access — staff, settings, all modules",
  manager: "Orders, analytics, and operations (no staff deletion)",
  cashier: "Billing & POS only",
  kitchen: "Kitchen order queue & preparation",
  delivery: "Delivery tracking & assigned orders"
};

export const STAFF_DIRECTORY_ROLE_DESCRIPTIONS: Record<StaffDirectoryRoleId, string> = {
  ...STAFF_ROLE_DESCRIPTIONS,
  staff: "Awaiting admin — assign role and approve to grant access"
};
