/**
 * Optional HTTPS Cloud Function URL for staff creation (Firebase Admin in Functions).
 * Example: `https://us-central1-YOUR_PROJECT.cloudfunctions.net/createStaffUser`
 *
 * When unset, the admin UI uses the Next.js route `/api/admin/staff-users` (same behavior, Admin SDK on the server).
 */
export function getStaffCreatePostUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_CREATE_STAFF_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "/api/admin/staff-users";
}
