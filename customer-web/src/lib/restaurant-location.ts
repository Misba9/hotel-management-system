/**
 * Default branch pin for customer tracking maps (matches seed `branches/hyderabad-main.location`).
 * Override with NEXT_PUBLIC_RESTAURANT_LAT / NEXT_PUBLIC_RESTAURANT_LNG.
 */
export function getDefaultRestaurantLocation(): { lat: number; lng: number } {
  const lat = Number(process.env.NEXT_PUBLIC_RESTAURANT_LAT ?? "17.4126");
  const lng = Number(process.env.NEXT_PUBLIC_RESTAURANT_LNG ?? "78.4482");
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: 17.4126, lng: 78.4482 };
}
