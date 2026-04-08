/** Saved row in top-level Firestore `addresses` collection. */
export type DeliveryAddress = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  /** Street / area / flat */
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryAddressInput = {
  name: string;
  phone: string;
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
};

export function formatDeliveryAddressForOrder(a: Pick<DeliveryAddress, "addressLine" | "landmark" | "city" | "pincode">): string {
  const line = [a.addressLine.trim(), a.city.trim(), a.pincode.trim()].filter(Boolean);
  if (a.landmark.trim()) line.splice(1, 0, `Near ${a.landmark.trim()}`);
  return line.join(", ");
}
