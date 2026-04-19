"use client";

import { useDeliveryAddress } from "@/context/delivery-address-context";

/**
 * Cached delivery addresses from `users/{uid}/addresses` via a single real-time listener.
 * Prefer this name in checkout/profile screens; same data as {@link useDeliveryAddress}.
 */
export function useUserAddresses() {
  return useDeliveryAddress();
}
