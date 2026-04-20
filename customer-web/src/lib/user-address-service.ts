/**
 * Persistent checkout addresses — Firestore `users/{userId}/addresses/{addressId}`.
 *
 * - **Live app data**: use {@link useDeliveryAddress} (React context) — subscribes with `onSnapshot`, caches in memory, no refetch per render.
 * - **Imperative API** (API routes, one-off): {@link saveAddress} / {@link getAddresses}.
 */
import type { DeliveryAddress, DeliveryAddressInput } from "@/lib/delivery-address-types";
import { addUserAddressDoc, getUserAddressesOnce } from "@/lib/address-book-firestore";

export type SaveAddressOptions = {
  email: string | null;
  /** True when this is the user’s first saved address → stored as `isDefault: true`. */
  isFirst: boolean;
};

/**
 * Create a new address document. Returns the saved row (selection in checkout is handled by {@link useDeliveryAddress}).
 */
export async function saveAddress(
  userId: string,
  input: DeliveryAddressInput,
  options?: SaveAddressOptions
): Promise<DeliveryAddress> {
  return addUserAddressDoc(userId, input, {
    email: options?.email ?? null,
    isFirst: options?.isFirst ?? false
  });
}

/** Fetch all addresses once (no subscription). Prefer context snapshot in UI. */
export async function getAddresses(userId: string): Promise<DeliveryAddress[]> {
  return getUserAddressesOnce(userId);
}

/** Fetch one persisted address (default first, otherwise first row). */
export async function getAddress(userId: string): Promise<DeliveryAddress | null> {
  const addresses = await getAddresses(userId);
  if (addresses.length === 0) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
}

export { getUserAddressesOnce, subscribeUserAddresses } from "@/lib/address-book-firestore";
