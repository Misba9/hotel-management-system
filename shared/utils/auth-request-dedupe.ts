import { getClientIpFromRequest } from "./client-ip";

const windowMs = 3_000;
const recent = new Map<string, number>();

function prune(now: number) {
  if (recent.size < 500) return;
  for (const [k, t] of recent) {
    if (now - t > windowMs) recent.delete(k);
  }
}

/** Returns true if this fingerprint was seen within the dedupe window (duplicate request). */
export function isDuplicateAuthAttempt(request: Request, email: string, mode: string): boolean {
  const ip = getClientIpFromRequest(request);
  const key = `${ip}:${email.toLowerCase().trim()}:${mode}`;
  const now = Date.now();
  prune(now);
  const last = recent.get(key);
  if (last !== undefined && now - last < windowMs) {
    return true;
  }
  recent.set(key, now);
  return false;
}
