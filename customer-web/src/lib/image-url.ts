/** Local asset — valid for `next/image` without remote config. */
export const MENU_IMAGE_FALLBACK = "/images/hero-fruits.svg";

export function isRemoteHttpUrl(src: string): boolean {
  const t = src.trim();
  return /^https?:\/\//i.test(t);
}

/**
 * Firestore / CMS often store emulator or dev URLs like `http://localhost:7071/...`.
 * Those fail in the browser (ERR_CONNECTION_REFUSED) when the emulator isn’t running.
 * Use HTTPS CDN, `/public` paths, or Firebase Storage for real `image` fields.
 */
function isPrivateOrUnreachableHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (![a, b, Number(m[3]), Number(m[4])].every((n) => n >= 0 && n <= 255)) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function shouldRejectForBrowser(src: string): boolean {
  const t = src.trim();
  if (!t) return true;
  if (t.startsWith("/")) return false;
  if (t.startsWith("data:") || t.startsWith("blob:")) return false;
  if (!/^https?:\/\//i.test(t)) return true;
  try {
    const u = new URL(t);
    const h = u.hostname.toLowerCase();
    if (isPrivateOrUnreachableHost(h)) return true;
    return false;
  } catch {
    return true;
  }
}

export function resolveMenuImageSrc(src: string | undefined | null): string {
  const t = typeof src === "string" ? src.trim() : "";
  if (!t || shouldRejectForBrowser(t)) return MENU_IMAGE_FALLBACK;
  return t;
}
