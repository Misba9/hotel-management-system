export const MENU_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop";

export function isRemoteHttpUrl(src: string): boolean {
  const t = src.trim();
  return /^https?:\/\//i.test(t);
}

function isPrivateOrUnreachableHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (![a, b, Number(m[3]), Number(m[4])].every((n) => n >= 0 && n <= 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function shouldRejectForClient(src: string): boolean {
  const t = src.trim();
  if (!t) return true;
  if (t.startsWith("data:") || t.startsWith("blob:")) return false;
  if (!/^https?:\/\//i.test(t)) return true;
  try {
    const u = new URL(t);
    return isPrivateOrUnreachableHost(u.hostname.toLowerCase());
  } catch {
    return true;
  }
}

export function resolveMenuImageSrc(src: string | undefined | null): string {
  const t = typeof src === "string" ? src.trim() : "";
  if (!t || shouldRejectForClient(t)) return MENU_IMAGE_FALLBACK;
  return t;
}
