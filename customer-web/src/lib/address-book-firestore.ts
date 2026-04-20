/**
 * Saved addresses: Firestore `users/{userId}/addresses/{addressId}` (subcollection).
 * Checkout + profile use {@link useDeliveryAddress} which subscribes here.
 */
import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe
} from "firebase/firestore";
import { mirrorUserAddressesToCustomerDoc } from "@/lib/customer-doc-sync";
import { db, ensureFirestoreOnline, safeGetDoc, tryGetDocFromCache } from "@/lib/firebase";
import { sortAddressesByRecentCreated } from "@/lib/address-suggestions";
import type { DeliveryAddress, DeliveryAddressInput, SavedAddressLabel } from "@/lib/delivery-address-types";
import { saveUserAddress } from "@/lib/save-user-address";

const PRIMARY_ADDRESS_COLLECTION = "address";
const PRIMARY_ADDRESS_DOC = "default";

function parseLabel(raw: unknown): SavedAddressLabel {
  const s = String(raw ?? "Home").trim();
  if (s === "Work" || s === "Other") return s;
  return "Home";
}

export function firestoreDocToDeliveryAddress(
  id: string,
  fallbackUserId: string,
  data: Record<string, unknown>
): DeliveryAddress | null {
  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const addressLine = String(data.addressLine ?? data.street ?? data.address ?? "").trim();
  const city = String(data.city ?? "").trim() || "Local";
  const landmark = String(data.landmark ?? data.state ?? "").trim();
  const pincode = String(data.pincode ?? "").trim();
  if (!name || !phone || !addressLine || !pincode) return null;
  let createdAt: string | undefined;
  let updatedAt: string | undefined;
  const c = data.createdAt;
  const u = data.updatedAt;
  if (c && typeof c === "object" && "toDate" in c && typeof (c as Timestamp).toDate === "function") {
    createdAt = (c as Timestamp).toDate().toISOString();
  } else if (typeof c === "string") createdAt = c;
  if (u && typeof u === "object" && "toDate" in u && typeof (u as Timestamp).toDate === "function") {
    updatedAt = (u as Timestamp).toDate().toISOString();
  } else if (typeof u === "string") updatedAt = u;
  const latRaw = data.lat;
  const lngRaw = data.lng;
  const lat = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : undefined;
  const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : undefined;
  const resolvedId =
    typeof data.id === "string" && data.id.trim().length > 0 ? data.id.trim() : id;

  return {
    id: resolvedId,
    userId: String(data.userId ?? fallbackUserId),
    label: parseLabel(data.label),
    name,
    phone,
    addressLine,
    landmark,
    city,
    pincode,
    lat,
    lng,
    isDefault: Boolean(data.isDefault),
    createdAt,
    updatedAt
  };
}

function primaryAddressDocRef(userId: string) {
  return doc(db, "users", userId, PRIMARY_ADDRESS_COLLECTION, PRIMARY_ADDRESS_DOC);
}

function toPrimaryAddressPayload(userId: string, id: string, input: DeliveryAddressInput, isDefault: boolean) {
  return {
    id,
    userId,
    sourceAddressId: id,
    label: input.label ?? "Home",
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    street: input.addressLine.trim(),
    landmark: input.landmark.trim(),
    state: input.landmark.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
    ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
    isDefault,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

async function getPrimaryAddressFallback(userId: string): Promise<DeliveryAddress | null> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = await tryGetDocFromCache(primaryAddressDocRef(userId));
      if (cached?.exists()) {
        return firestoreDocToDeliveryAddress("default", userId, cached.data() as Record<string, unknown>);
      }
      return null;
    }
    const snap = await safeGetDoc(primaryAddressDocRef(userId));
    if (!snap.exists()) return null;
    return firestoreDocToDeliveryAddress("default", userId, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

function inputToSummaryPayload(input: DeliveryAddressInput) {
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

/**
 * One-time fetch (e.g. scripts/tests). Checkout uses {@link subscribeUserAddresses} for live cache.
 */
export async function getUserAddressesOnce(userId: string): Promise<DeliveryAddress[]> {
  try {
    await ensureFirestoreOnline();
    const snap = await getDocs(collection(db, "users", userId, "addresses"));
    const list: DeliveryAddress[] = [];
    snap.forEach((d) => {
      const row = firestoreDocToDeliveryAddress(d.id, userId, d.data() as Record<string, unknown>);
      if (row) list.push(row);
    });
    if (list.length > 0) return sortAddressesByRecentCreated(list);
    const fallback = await getPrimaryAddressFallback(userId);
    return fallback ? [fallback] : [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[address-book] getUserAddressesOnce failed", e);
    }
    return [];
  }
}

export function subscribeUserAddresses(
  userId: string,
  onNext: (addresses: DeliveryAddress[]) => void,
  onError?: (e: FirebaseError) => void
): Unsubscribe {
  const colRef = collection(db, "users", userId, "addresses");
  let fallbackInFlight = false;
  /** Guards fallback resolution against newer snapshots (avoids overwriting a non-empty list). */
  let snapshotGeneration = 0;
  return onSnapshot(
    colRef,
    (snap) => {
      const generation = ++snapshotGeneration;
      const list: DeliveryAddress[] = [];
      snap.forEach((d) => {
        const row = firestoreDocToDeliveryAddress(d.id, userId, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      });
      if (list.length > 0) {
        onNext(sortAddressesByRecentCreated(list));
        return;
      }
      /** Empty subcollection: unblock UI immediately; enrich from primary doc async (never hang on getDoc). */
      onNext([]);
      if (fallbackInFlight) return;
      fallbackInFlight = true;
      void getPrimaryAddressFallback(userId)
        .then((fallback) => {
          if (generation !== snapshotGeneration) return;
          if (fallback) onNext([fallback]);
        })
        .finally(() => {
          fallbackInFlight = false;
        });
    },
    (err) => {
      if (err instanceof FirebaseError) onError?.(err);
    }
  );
}

/** One-time copy from embedded `users` doc into subcollection (empty sub only). */
export async function migrateEmbeddedAddressesToSubcollection(
  userId: string,
  embedded: DeliveryAddress[]
): Promise<void> {
  if (embedded.length === 0) return;
  await ensureFirestoreOnline();
  const colRef = collection(db, "users", userId, "addresses");
  const existing = await getDocs(colRef);
  if (!existing.empty) return;

  let batch = writeBatch(db);
  let n = 0;
  for (const a of embedded) {
    const ref = doc(colRef, a.id);
    batch.set(ref, {
      id: a.id,
      userId,
      label: a.label,
      name: a.name,
      phone: a.phone,
      addressLine: a.addressLine,
      landmark: a.landmark,
      city: a.city,
      pincode: a.pincode,
      isDefault: a.isDefault,
      ...(typeof a.lat === "number" ? { lat: a.lat } : {}),
      ...(typeof a.lng === "number" ? { lng: a.lng } : {}),
      createdAt: a.createdAt ? Timestamp.fromDate(new Date(a.createdAt)) : serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
  await mirrorUserAddressesToCustomerDoc(userId).catch((e) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[address-book] customer mirror after migration failed", e);
    }
  });
}

export async function addUserAddressDoc(
  userId: string,
  input: DeliveryAddressInput,
  options: { email: string | null; isFirst: boolean }
): Promise<DeliveryAddress> {
  await ensureFirestoreOnline();
  const label = input.label ?? "Home";
  const colRef = collection(db, "users", userId, "addresses");

  const docRef = await addDoc(colRef, {
    userId,
    label,
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    landmark: input.landmark.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
    ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
    isDefault: options.isFirst,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(docRef, { id: docRef.id });

  const id = docRef.id;
  await setDoc(primaryAddressDocRef(userId), toPrimaryAddressPayload(userId, id, input, options.isFirst), { merge: true });

  if (options.email?.trim()) {
    await setDoc(
      doc(db, "users", userId),
      { name: input.name.trim(), phone: input.phone.trim(), email: options.email.trim(), updatedAt: serverTimestamp() },
      { merge: true }
    );
  } else {
    await setDoc(
      doc(db, "users", userId),
      { name: input.name.trim(), phone: input.phone.trim(), updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  const now = new Date().toISOString();
  const parsed: DeliveryAddress = {
    id,
    userId,
    label: label as SavedAddressLabel,
    name: input.name.trim(),
    phone: input.phone.trim(),
    addressLine: input.addressLine.trim(),
    landmark: input.landmark.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
    ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
    isDefault: options.isFirst,
    createdAt: now,
    updatedAt: now
  };

  void saveUserAddress(userId, inputToSummaryPayload(input))
    .then(() => console.log("[address-book] summary field synced"))
    .catch((e) => console.error("[address-book] summary field failed (non-fatal)", e));

  await mirrorUserAddressesToCustomerDoc(userId).catch((e) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[address-book] customer mirror failed", e);
    }
  });

  return parsed;
}

export async function updateUserAddressDoc(userId: string, addressId: string, input: DeliveryAddressInput): Promise<void> {
  await ensureFirestoreOnline();
  const label = input.label ?? "Home";
  await setDoc(
    doc(db, "users", userId, "addresses", addressId),
    {
      label,
      name: input.name.trim(),
      phone: input.phone.trim(),
      addressLine: input.addressLine.trim(),
      landmark: input.landmark.trim(),
      city: input.city.trim(),
      pincode: input.pincode.trim(),
      ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
      ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  const primarySnap = await safeGetDoc(primaryAddressDocRef(userId));
  const primaryData = primarySnap.exists() ? (primarySnap.data() as Record<string, unknown>) : null;
  const shouldSyncPrimary =
    !primaryData ||
    String(primaryData.sourceAddressId ?? primaryData.id ?? "").trim() === addressId;
  if (shouldSyncPrimary) {
    await setDoc(primaryAddressDocRef(userId), toPrimaryAddressPayload(userId, addressId, input, Boolean(primaryData?.isDefault)), { merge: true });
  }

  void saveUserAddress(userId, inputToSummaryPayload(input))
    .then(() => console.log("[address-book] summary field synced"))
    .catch((e) => console.error("[address-book] summary field failed (non-fatal)", e));

  await mirrorUserAddressesToCustomerDoc(userId).catch((e) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[address-book] customer mirror failed", e);
    }
  });
}

export async function deleteUserAddressDoc(userId: string, addressId: string): Promise<void> {
  await ensureFirestoreOnline();
  const colRef = collection(db, "users", userId, "addresses");
  const snap = await getDocs(colRef);
  const target = snap.docs.find((d) => d.id === addressId);
  if (!target) return;

  const wasDefault = Boolean((target.data() as { isDefault?: boolean }).isDefault);
  const others = snap.docs.filter((d) => d.id !== addressId);

  const batch = writeBatch(db);
  batch.delete(target.ref);
  if (wasDefault && others.length > 0) {
    others.forEach((d, i) => {
      batch.update(d.ref, {
        isDefault: i === 0,
        updatedAt: serverTimestamp()
      });
    });
  }
  await batch.commit();
  const primarySnap = await safeGetDoc(primaryAddressDocRef(userId));
  const primaryData = primarySnap.exists() ? (primarySnap.data() as Record<string, unknown>) : null;
  const linkedPrimaryId = String(primaryData?.sourceAddressId ?? primaryData?.id ?? "").trim();
  if (linkedPrimaryId === addressId) {
    if (others.length === 0) {
      await deleteDoc(primaryAddressDocRef(userId));
    } else {
      const nextData = others[0].data() as Record<string, unknown>;
      const next = firestoreDocToDeliveryAddress(others[0].id, userId, nextData);
      if (next) {
        await setDoc(
          primaryAddressDocRef(userId),
          {
            id: next.id,
            userId,
            sourceAddressId: next.id,
            label: next.label,
            name: next.name,
            phone: next.phone,
            addressLine: next.addressLine,
            street: next.addressLine,
            landmark: next.landmark,
            state: next.landmark,
            city: next.city,
            pincode: next.pincode,
            ...(typeof next.lat === "number" ? { lat: next.lat } : {}),
            ...(typeof next.lng === "number" ? { lng: next.lng } : {}),
            isDefault: next.isDefault,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }
    }
  }

  await mirrorUserAddressesToCustomerDoc(userId).catch((e) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[address-book] customer mirror failed", e);
    }
  });
}

export async function setDefaultUserAddress(userId: string, addressId: string): Promise<void> {
  await ensureFirestoreOnline();
  const colRef = collection(db, "users", userId, "addresses");
  const snap = await getDocs(colRef);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.forEach((d) => {
    batch.update(d.ref, {
      isDefault: d.id === addressId,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();

  const chosen = snap.docs.find((d) => d.id === addressId);
  if (chosen) {
    const data = chosen.data() as Record<string, unknown>;
    const chosenInput: DeliveryAddressInput = {
      label: parseLabel(data.label),
      name: String(data.name ?? ""),
      phone: String(data.phone ?? ""),
      addressLine: String(data.addressLine ?? data.street ?? data.address ?? ""),
      landmark: String(data.landmark ?? data.state ?? ""),
      city: String(data.city ?? ""),
      pincode: String(data.pincode ?? ""),
      ...(typeof data.lat === "number" ? { lat: data.lat } : {}),
      ...(typeof data.lng === "number" ? { lng: data.lng } : {})
    };
    await setDoc(primaryAddressDocRef(userId), toPrimaryAddressPayload(userId, addressId, chosenInput, true), { merge: true });
    const line = String(data.addressLine ?? "").trim();
    const landmark = String(data.landmark ?? "").trim();
    const fullAddress = [line, landmark].filter(Boolean).join(", ");
    void saveUserAddress(userId, {
      fullAddress,
      city: String(data.city ?? "").trim(),
      pincode: String(data.pincode ?? "").trim(),
      phone: String(data.phone ?? "").trim()
    }).catch((e) => console.error("[address-book] default summary sync failed", e));
  }

  await mirrorUserAddressesToCustomerDoc(userId).catch((e) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[address-book] customer mirror failed", e);
    }
  });
}
