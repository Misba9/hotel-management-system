/** Local asset — valid for `next/image` without remote config. */
export const MENU_IMAGE_FALLBACK = "/images/hero-fruits.svg";

export function isRemoteHttpUrl(src: string): boolean {
  const t = src.trim();
  return /^https?:\/\//i.test(t);
}

export function resolveMenuImageSrc(src: string | undefined | null): string {
  const t = typeof src === "string" ? src.trim() : "";
  return t.length > 0 ? t : MENU_IMAGE_FALLBACK;
}
