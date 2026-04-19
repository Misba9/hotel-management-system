import type { DeliveryAddress } from "@/lib/delivery-address-types";
import { getDistanceKm } from "@/lib/geo-distance";

function recencyMs(a: DeliveryAddress): number {
  const raw = a.createdAt ?? a.updatedAt ?? "";
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/** Newest first (by `createdAt`, then `updatedAt`). */
export function sortAddressesByRecentCreated(list: DeliveryAddress[]): DeliveryAddress[] {
  return [...list].sort((a, b) => recencyMs(b) - recencyMs(a));
}

/**
 * If `user` is set and at least one address has coordinates, sort by distance ascending
 * (unknown coordinates sort last). Otherwise sort by recent created.
 */
export function sortAddressesSmart(
  list: DeliveryAddress[],
  user: { lat: number; lng: number } | null
): DeliveryAddress[] {
  const copy = [...list];
  const anyGeo = copy.some((a) => typeof a.lat === "number" && typeof a.lng === "number");

  if (user && anyGeo) {
    return copy.sort((a, b) => {
      const da =
        typeof a.lat === "number" && typeof a.lng === "number"
          ? getDistanceKm(user, { lat: a.lat, lng: a.lng })
          : Number.POSITIVE_INFINITY;
      const db =
        typeof b.lat === "number" && typeof b.lng === "number"
          ? getDistanceKm(user, { lat: b.lat, lng: b.lng })
          : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return recencyMs(b) - recencyMs(a);
    });
  }

  return sortAddressesByRecentCreated(copy);
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
