import { adminRtdb } from "@shared/firebase/rtdb-admin";

/**
 * Best-effort Realtime Database sync for `orderFeeds/{orderId}`.
 * Firestore remains the source of truth; RTDB failures must not fail HTTP handlers.
 */
export async function setOrderFeed(orderId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await adminRtdb.ref(`orderFeeds/${orderId}`).set(data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[orderFeeds] RTDB set skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

export async function updateOrderFeed(orderId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await adminRtdb.ref(`orderFeeds/${orderId}`).update(data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[orderFeeds] RTDB update skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
