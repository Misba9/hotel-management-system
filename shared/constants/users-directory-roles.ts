/**
 * Roles for the admin "User directory" (`users` collection) UI.
 * Stored in Firestore as `users/{uid}.role` using these string values.
 * Auth custom claims use `userDirectoryRoleToAuthClaim` (kitchen → kitchen_staff, etc.).
 */
export const USER_DIRECTORY_ROLE_IDS = [
  "admin",
  "manager",
  "kitchen",
  "cashier",
  "delivery",
  "waiter"
] as const;

export type UserDirectoryRoleId = (typeof USER_DIRECTORY_ROLE_IDS)[number];

export function isUserDirectoryRoleId(value: string): value is UserDirectoryRoleId {
  return (USER_DIRECTORY_ROLE_IDS as readonly string[]).includes(value);
}

/** Maps directory role to Firebase Auth custom claim `role`. */
export function userDirectoryRoleToAuthClaim(role: UserDirectoryRoleId): string {
  switch (role) {
    case "kitchen":
      return "kitchen_staff";
    case "delivery":
      return "delivery_boy";
    default:
      return role;
  }
}
