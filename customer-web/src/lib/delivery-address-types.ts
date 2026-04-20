/**
 * Saved addresses: primary store is Firestore `users/{userId}/addresses/{addressId}` (subcollection).
 * Legacy embedded `users/{userId}.addresses` may still exist and is migrated client-side when the subcollection is empty.
 */
export type SavedAddressLabel = "Home" | "Work" | "Other";

export type DeliveryAddress = {
  id: string;
  userId: string;
  label: SavedAddressLabel;
  name: string;
  phone: string;
  /** Street / area / flat */
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
  /** Optional geocode — used for map links on orders/admin. */
  lat?: number;
  lng?: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryAddressInput = {
  label?: SavedAddressLabel;
  name: string;
  phone: string;
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
};

/** Copied onto `orders/{orderId}` — self-contained snapshot (no user doc lookup). */
export type SerializedDeliveryAddress = {
  id: string;
  label: SavedAddressLabel;
  name: string;
  phone: string;
  addressLine: string;
  landmark?: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
};

export function toSerializedDeliveryAddress(a: DeliveryAddress): SerializedDeliveryAddress {
  const landmark = a.landmark.trim();
  return {
    id: a.id,
    label: a.label,
    name: a.name.trim(),
    phone: a.phone.trim(),
    addressLine: a.addressLine.trim(),
    ...(landmark ? { landmark } : {}),
    city: a.city.trim(),
    pincode: a.pincode.trim(),
    ...(typeof a.lat === "number" && Number.isFinite(a.lat) ? { lat: a.lat } : {}),
    ...(typeof a.lng === "number" && Number.isFinite(a.lng) ? { lng: a.lng } : {})
  };
}

export function formatDeliveryAddressForOrder(
  a: Pick<DeliveryAddress, "addressLine" | "landmark" | "city" | "pincode">
): string {
  const line = [a.addressLine.trim(), a.city.trim(), a.pincode.trim()].filter(Boolean);
  if (a.landmark.trim()) line.splice(1, 0, `Near ${a.landmark.trim()}`);
  return line.join(", ");
}

/** India PIN — 6 digits. */
export function isValidPincode(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}
