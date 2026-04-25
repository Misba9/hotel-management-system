/**
 * Firebase Console may show `PROJECT.firebasestorage.app`. For the JS SDK, prefer the
 * default bucket id `PROJECT.appspot.com` to avoid upload/CORS quirks with the newer hostname.
 */
export function normalizeFirebaseStorageBucket(
  raw: string | undefined,
  projectId: string
): string {
  const pid = projectId.trim() || "unknown";
  const first = (raw ?? "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .split("/")[0]
    .trim();
  if (!first) return `${pid}.appspot.com`;
  if (first.includes(".firebasestorage.app")) {
    return `${pid}.appspot.com`;
  }
  return first;
}
