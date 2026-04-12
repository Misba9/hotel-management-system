/**
 * Staff auth / Firestore path debugging. Enable in dev, or set EXPO_PUBLIC_DEBUG_STAFF_AUTH=true in .env
 */
function isStaffAuthDebugEnabled(): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const v = env?.EXPO_PUBLIC_DEBUG_STAFF_AUTH;
    return v === "true" || v === "1";
  } catch {
    return false;
  }
}

export function logStaffAuth(stage: string, payload: Record<string, unknown>): void {
  if (!isStaffAuthDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[StaffAuth] ${stage}`, payload);
}
