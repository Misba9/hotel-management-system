/**
 * Helpers for Google Places `address_components` → checkout form fields (India-friendly).
 */

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const CITY_TYPES = [
  "locality",
  "administrative_area_level_3",
  "sublocality_level_1",
  "sublocality",
  "neighborhood"
] as const;

export function extractCity(components: GoogleAddressComponent[]): string {
  for (const t of CITY_TYPES) {
    const c = components.find((x) => x.types.includes(t));
    if (c?.long_name?.trim()) return c.long_name.trim();
  }
  const admin2 = components.find((x) => x.types.includes("administrative_area_level_2"));
  return admin2?.long_name?.trim() ?? "";
}

export function extractPincode(components: GoogleAddressComponent[]): string {
  const c = components.find((x) => x.types.includes("postal_code"));
  return c?.long_name?.trim() ?? "";
}

export type PlacesFormPatch = {
  addressLine: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
};

function readLatLng(loc: { lat(): number; lng(): number } | { lat: number; lng: number }): { lat: number; lng: number } | null {
  if (!loc) return null;
  const lat = typeof (loc as { lat: () => number }).lat === "function" ? (loc as { lat: () => number }).lat() : Number((loc as { lat: number }).lat);
  const lng = typeof (loc as { lng: () => number }).lng === "function" ? (loc as { lng: () => number }).lng() : Number((loc as { lng: number }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Maps a Places `PlaceResult` into fields we store on `DeliveryAddressInput` + lat/lng. */
export function parsePlaceToFormPatch(place: {
  formatted_address?: string;
  name?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: { lat(): number; lng(): number } | { lat: number; lng: number } };
}): PlacesFormPatch | null {
  const components = place.address_components;
  if (!components?.length) return null;

  const addressLine = (place.formatted_address ?? place.name ?? "").trim();
  if (!addressLine) return null;

  const city = extractCity(components);
  const pincode = extractPincode(components);

  const ll = readLatLng(place.geometry?.location as { lat(): number; lng(): number });
  if (!ll) {
    return { addressLine, city, pincode };
  }

  return { addressLine, city, pincode, lat: ll.lat, lng: ll.lng };
}
