import { getFirestore } from "firebase-admin/firestore";
import { getDistance } from "geolib";
import { syncDeliveryTrackingDoc } from "./v1/common";

const db = getFirestore();

type RiderCandidate = {
  id: string;
  location?: { lat: number; lng: number };
  activeOrders: number;
  online: boolean;
};

export async function assignNearestDeliveryBoy(params: {
  orderId: string;
  branchLocation: { lat: number; lng: number };
}) {
  const { orderId, branchLocation } = params;
  const ridersSnapshot = await db.collection("staff").where("role", "==", "delivery_boy").where("online", "==", true).get();

  const maxActiveOrders = Number(process.env.MAX_ACTIVE_DELIVERIES ?? 3);
  const candidates = ridersSnapshot.docs
    .map((doc) => ({ ...(doc.data() as RiderCandidate), id: doc.id }))
    .filter((candidate) => candidate.online && candidate.activeOrders < maxActiveOrders && Boolean(candidate.location))
    .map((candidate) => ({
      ...candidate,
      location: candidate.location as { lat: number; lng: number }
    }));
  if (candidates.length === 0) {
    return null;
  }

  const distanceKmByRider = await getDistancesKm(candidates, branchLocation);
  const scored = candidates
    .map((rider) => {
      const distanceKm = distanceKmByRider[rider.id] ?? fallbackDistanceKm(rider.location!, branchLocation);
      const workloadPenalty = rider.activeOrders * 1.5;
      return { rider, distanceKm, score: distanceKm + workloadPenalty };
    })
    .sort((a, b) => a.score - b.score);

  const best = scored[0];
  if (!best) return null;

  const nowIso = new Date().toISOString();
  const estimatedMinutes = Math.max(6, Math.round((best.distanceKm / 20) * 60));
  const assignmentRef = db.collection("delivery_assignments").doc();
  await assignmentRef.set({
    id: assignmentRef.id,
    orderId,
    deliveryBoyId: best.rider.id,
    status: "assigned",
    distanceKm: Number(best.distanceKm.toFixed(2)),
    workloadAtAssign: best.rider.activeOrders,
    estimatedMinutes,
    assignedAt: nowIso,
    updatedAt: nowIso
  });

  await db.collection("staff").doc(best.rider.id).update({
    activeOrders: best.rider.activeOrders + 1
  });

  /** Canonical `assignedTo.deliveryId` plus legacy ids for older clients. */
  await db.collection("orders").doc(orderId).set(
    {
      deliveryPartnerId: best.rider.id,
      deliveryBoyId: best.rider.id,
      "assignedTo.deliveryId": best.rider.id,
      updatedAt: nowIso
    },
    { merge: true }
  );

  await syncDeliveryTrackingDoc(orderId, {
    assignmentId: assignmentRef.id,
    deliveryBoyId: best.rider.id,
    status: "assigned",
    distanceKm: Number(best.distanceKm.toFixed(2)),
    estimatedMinutes,
    etaMinutes: estimatedMinutes,
    lat: best.rider.location!.lat,
    lng: best.rider.location!.lng,
    updatedAt: nowIso
  });

  return {
    assignmentId: assignmentRef.id,
    riderId: best.rider.id,
    distanceKm: Number(best.distanceKm.toFixed(2)),
    estimatedMinutes
  };
}

async function getDistancesKm(
  riders: Array<RiderCandidate & { id: string; location: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
) {
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsApiKey || riders.length === 0) {
    return {} as Record<string, number>;
  }

  try {
    const origins = riders.map((rider) => `${rider.location.lat},${rider.location.lng}`).join("|");
    const destinationStr = `${destination.lat},${destination.lng}`;
    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinationStr)}` +
      "&mode=driving" +
      `&key=${encodeURIComponent(mapsApiKey)}`;

    const res = await fetch(url);
    if (!res.ok) return {};
    const payload = (await res.json()) as {
      rows?: Array<{ elements?: Array<{ status?: string; distance?: { value?: number } }> }>;
    };

    const distances: Record<string, number> = {};
    riders.forEach((rider, idx) => {
      const element = payload.rows?.[idx]?.elements?.[0];
      if (element?.status === "OK" && typeof element.distance?.value === "number") {
        distances[rider.id] = element.distance.value / 1000;
      }
    });
    return distances;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Google Maps distance lookup failed:", error);
    }
    return {};
  }
}

function fallbackDistanceKm(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  const distanceM = getDistance(
    { latitude: origin.lat, longitude: origin.lng },
    { latitude: destination.lat, longitude: destination.lng }
  );
  return distanceM / 1000;
}
