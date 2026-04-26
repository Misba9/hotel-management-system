/**
 * Normalize only syntax (`gs://` and path suffixes) while preserving the exact bucket host
 * configured in Firebase Console (`*.appspot.com` or `*.firebasestorage.app`).
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
  return first;
}
