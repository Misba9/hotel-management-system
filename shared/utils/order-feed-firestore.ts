import { adminDb } from "@shared/firebase/admin";

/**
 * Best-effort Firestore mirror for legacy `orderFeeds/{orderId}` RTDB paths.
 * Firestore `orders` remains the source of truth; sync failures must not fail HTTP handlers.
 */
export async function setOrderFeed(orderId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await adminDb.collection("orderFeeds").doc(orderId).set(data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[orderFeeds] Firestore set skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

export async function updateOrderFeed(orderId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await adminDb.collection("orderFeeds").doc(orderId).set(data, { merge: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[orderFeeds] Firestore merge skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
