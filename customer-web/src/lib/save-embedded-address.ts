import { FirebaseError } from "firebase/app";
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DeliveryAddress, DeliveryAddressInput } from "@/lib/delivery-address-types";
import { embeddedMapToDelivery, parseAddressesField } from "@/lib/parse-embedded-addresses";
import { saveUserAddress, type UserAddressPayload } from "@/lib/save-user-address";

function inputToUserAddressPayload(input: DeliveryAddressInput): UserAddressPayload {
  const line = input.addressLine.trim();
  const landmark = input.landmark.trim();
  const fullAddress = landmark ? `${line}, ${landmark}` : line;
  return {
    fullAddress,
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    phone: input.phone.trim()
  };
}

function deliveryToUserAddressPayload(d: DeliveryAddress): UserAddressPayload {
  const fullAddress = [d.addressLine.trim(), d.landmark.trim()].filter(Boolean).join(", ");
  return {
    fullAddress,
    city: d.city.trim(),
    pincode: d.pincode.trim(),
    phone: d.phone.trim()
  };
}

export function deliveryAddressToInput(d: DeliveryAddress): DeliveryAddressInput {
  return {
    label: d.label,
    name: d.name,
    phone: d.phone,
    addressLine: d.addressLine,
    landmark: d.landmark,
    city: d.city,
    pincode: d.pincode,
    ...(typeof d.lat === "number" && Number.isFinite(d.lat) ? { lat: d.lat } : {}),
    ...(typeof d.lng === "number" && Number.isFinite(d.lng) ? { lng: d.lng } : {})
  };
}

function buildEmbeddedRow(
  userId: string,
  input: DeliveryAddressInput,
  addressId: string,
  isFirst: boolean
): Record<string, unknown> {
  const label = input.label ?? "Home";
  return {
    id: addressId,
    userId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    landmark: input.landmark.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    label,
    ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
    ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
    isDefault: isFirst,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
}

/**
 * Appends one address to `users/{uid}.addresses` via `arrayUnion`, with setDoc fallback when the user doc is missing.
 * No client-side Promise.race timeout — Firestore handles retries/backoff.
 */
export async function saveAddress(
  userId: string,
  input: DeliveryAddressInput,
  options: { email: string | null; isFirst: boolean }
): Promise<DeliveryAddress> {
  const addressId = crypto.randomUUID();
  const row = buildEmbeddedRow(userId, input, addressId, options.isFirst);
  const userRef = doc(db, "users", userId);

  const profileMerge: Record<string, unknown> = {
    name: row.name as string,
    phone: row.phone as string,
    updatedAt: serverTimestamp()
  };
  if (options.email?.trim()) profileMerge.email = options.email.trim();

  try {
    await updateDoc(userRef, {
      ...profileMerge,
      addresses: arrayUnion(row)
    });
  } catch (e) {
    const code = e instanceof FirebaseError ? e.code : "";
    if (code === "not-found") {
      await setDoc(
        userRef,
        {
          uid: userId,
          ...profileMerge,
          addresses: [row]
        },
        { merge: true }
      );
    } else {
      throw e;
    }
  }

  const parsed = embeddedMapToDelivery(userId, row);
  if (!parsed) {
    throw new Error("Failed to save address");
  }

  await saveUserAddress(userId, inputToUserAddressPayload(input));
  return parsed;
}

/** Push a previously offline `temp-*` address to Firestore once the client is online. */
export async function syncTempAddressToAccount(
  userId: string,
  temp: DeliveryAddress,
  options: { email: string | null; isFirst: boolean }
): Promise<DeliveryAddress> {
  if (!temp.id.startsWith("temp-")) {
    throw new Error("Not a temporary address");
  }
  return saveAddress(userId, deliveryAddressToInput(temp), options);
}

/** Read current `addresses` array for full-array updates (edit / delete / default). */
export async function getEmbeddedAddressesFromUserDoc(userId: string): Promise<DeliveryAddress[]> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  return parseAddressesField(userId, data.addresses);
}

function deliveryToFirestoreMap(d: DeliveryAddress): Record<string, unknown> {
  const created =
    d.createdAt && !Number.isNaN(Date.parse(d.createdAt))
      ? Timestamp.fromDate(new Date(d.createdAt))
      : Timestamp.now();
  const updated =
    d.updatedAt && !Number.isNaN(Date.parse(d.updatedAt))
      ? Timestamp.fromDate(new Date(d.updatedAt))
      : Timestamp.now();
  return {
    id: d.id,
    userId: d.userId,
    label: d.label,
    name: d.name,
    phone: d.phone,
    addressLine: d.addressLine,
    landmark: d.landmark,
    city: d.city,
    pincode: d.pincode,
    ...(typeof d.lat === "number" && Number.isFinite(d.lat) ? { lat: d.lat } : {}),
    ...(typeof d.lng === "number" && Number.isFinite(d.lng) ? { lng: d.lng } : {}),
    isDefault: d.isDefault,
    createdAt: created,
    updatedAt: updated
  };
}

/** Replaces the entire `addresses` array on `users/{uid}` (edit / remove / default). */
export async function replaceUserEmbeddedAddresses(userId: string, addresses: DeliveryAddress[]): Promise<void> {
  const embedded = addresses.map(deliveryToFirestoreMap);
  await setDoc(
    doc(db, "users", userId),
    {
      addresses: embedded,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  const primary = addresses.find((a) => a.isDefault) ?? addresses[0];
  if (primary) {
    await saveUserAddress(userId, deliveryToUserAddressPayload(primary));
  }
}
