import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@shared/firebase/admin";

/**
 * Upserts `deliveryLocations/{orderId}` for live map + ETA (customer read via rules).
 */
export async function mergeDeliveryLocationDoc(
  orderId: string,
  patch: {
    lat: number;
    lng: number;
    etaMinutes?: number;
  }
): Promise<void> {
  const orderSnap = await adminDb.collection("orders").doc(orderId).get();
  const userId = String(orderSnap.data()?.userId ?? "");

  await adminDb
    .collection("deliveryLocations")
    .doc(orderId)
    .set(
      {
        orderId,
        userId,
        lat: patch.lat,
        lng: patch.lng,
        ...(typeof patch.etaMinutes === "number" && Number.isFinite(patch.etaMinutes)
          ? { etaMinutes: patch.etaMinutes }
          : {}),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}
