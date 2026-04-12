import type { Timestamp } from "firebase/firestore";

/** Next.js admin routes and `createStaffUser` Cloud Function return `{ error?: string, details?: zod issues }`. */
export function formatAdminStaffApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed.";
  const o = data as { error?: unknown; details?: unknown };
  if (typeof o.error === "string" && o.error.trim()) return o.error;
  if (Array.isArray(o.details)) {
    const first = o.details[0] as { message?: string } | undefined;
    if (first && typeof first.message === "string") return first.message;
  }
  return "Request failed.";
}

export function parseCreatedAt(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof (raw as Timestamp).toDate === "function") {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  if (raw instanceof Date) return raw;
  return null;
}
