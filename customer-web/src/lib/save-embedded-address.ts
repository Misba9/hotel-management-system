import { FirebaseError } from "firebase/app";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { mirrorUserAddressesToCustomerDoc } from "@/lib/customer-doc-sync";
import { db, ensureFirestoreOnline, safeGetDoc } from "@/lib/firebase";
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
 *
 * The flat `address` summary (`saveUserAddress`) is written in the background so a second merge on the same doc
 * cannot block resolution of this function after the embedded array write succeeds (fixes stuck "Saving…" UI).
 */
export async function saveAddress(
  userId: string,
  input: DeliveryAddressInput,
  options: { email: string | null; isFirst: boolean }
): Promise<DeliveryAddress> {
  console.log("[saveAddress] start", { userId, addressLine: input.addressLine?.slice(0, 40) });

  try {
    await ensureFirestoreOnline();
    const addressId = crypto.randomUUID();
    const row = buildEmbeddedRow(userId, input, addressId, options.isFirst);
    const userRef = doc(db, "users", userId);

    const profileMerge: Record<string, unknown> = {
      name: row.name as string,
      phone: row.phone as string,
      updatedAt: serverTimestamp()
    };
    if (options.email?.trim()) profileMerge.email = options.email.trim();

    console.log("[saveAddress] writing embedded addresses[] …");
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
        console.error("[saveAddress] embedded write error", e);
        throw e;
      }
    }

    console.log("[saveAddress] embedded write OK");

    const parsed = embeddedMapToDelivery(userId, row);
    if (!parsed) {
      throw new Error("Failed to parse saved address");
    }

    const summaryPayload = inputToUserAddressPayload(input);
    void saveUserAddress(userId, summaryPayload)
      .then(() => console.log("[saveAddress] address summary field OK (background)"))
      .catch((err) => console.error("[saveAddress] address summary field failed (non-fatal)", err));

    await mirrorUserAddressesToCustomerDoc(userId).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[saveAddress] customer mirror failed (non-fatal)", err);
      }
    });

    console.log("[saveAddress] success (returning)", { id: parsed.id });
    return parsed;
  } catch (error) {
    console.error("[saveAddress] error", error);
    throw error;
  }
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
  await ensureFirestoreOnline();
  const snap = await safeGetDoc(doc(db, "users", userId));
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
  await ensureFirestoreOnline();
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
