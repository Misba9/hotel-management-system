/**
 * Client Firestore helpers for `deliveryLocations/{orderId}` (legacy mirror of rider GPS).
 * Primary live position for customers is `orders/{orderId}.riderLocation` via `useOrderRealtime`.
 * Writes require staff role in Firestore rules (delivery / manager / admin).
 */
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

export type DeliveryLocationData = {
  orderId: string;
  userId?: string;
  lat: number;
  lng: number;
  etaMinutes?: number;
  updatedAt?: unknown;
};

function mapSnap(data: Record<string, unknown>, orderId: string): DeliveryLocationData | null {
  const lat = data.lat;
  const lng = data.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    orderId: typeof data.orderId === "string" ? data.orderId : orderId,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    lat,
    lng,
    etaMinutes: typeof data.etaMinutes === "number" ? data.etaMinutes : undefined,
    updatedAt: data.updatedAt
  };
}

export function subscribeToDeliveryLocation(
  db: Firestore,
  orderId: string,
  onData: (data: DeliveryLocationData | null) => void,
  onError?: (err: Error) => void
) {
  const ref = doc(db, "deliveryLocations", orderId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data() as Record<string, unknown>;
      onData(mapSnap(raw, orderId));
    },
    (err) => onError?.(err)
  );
}

/**
 * Upserts live coordinates for an order (`setDoc` + merge).
 * Use from staff/delivery clients only; prefer `/api/delivery/update-location` when possible.
 */
export async function setDeliveryLocation(
  db: Firestore,
  orderId: string,
  params: { userId: string; lat: number; lng: number; etaMinutes?: number }
): Promise<void> {
  await setDoc(
    doc(db, "deliveryLocations", orderId),
    {
      orderId,
      userId: params.userId,
      lat: params.lat,
      lng: params.lng,
      ...(typeof params.etaMinutes === "number" && Number.isFinite(params.etaMinutes)
        ? { etaMinutes: params.etaMinutes }
        : {}),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
