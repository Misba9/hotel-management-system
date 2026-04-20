import type { User } from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db, ensureFirestoreOnline, safeGetDoc } from "@/lib/firebase";
import { withRetry } from "@shared/utils/retry";

export const CUSTOMERS_COLLECTION = "customers";

/** Mirror shape on `customers/{uid}` for admin + integrations. */
export type CustomerDocAddress = {
  id: string;
  label: "Home" | "Work";
  addressLine: string;
  city: string;
  lat: number;
  lng: number;
};

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function toCustomerLabel(raw: unknown): "Home" | "Work" {
  const s = String(raw ?? "Home").trim();
  return s === "Work" ? "Work" : "Home";
}

function subDocToCustomerAddress(docId: string, data: Record<string, unknown>): CustomerDocAddress | null {
  const line = String(data.addressLine ?? data.street ?? data.address ?? "").trim();
  const landmark = String(data.landmark ?? data.state ?? "").trim();
  const addressLine = landmark ? `${line}, ${landmark}` : line;
  const city = String(data.city ?? "").trim() || "—";
  if (!addressLine) return null;
  const latRaw = data.lat;
  const lngRaw = data.lng;
  const lat = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : 0;
  const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : 0;
  const id = String(data.id ?? docId).trim() || docId;
  return {
    id,
    label: toCustomerLabel(data.label),
    addressLine,
    city,
    lat,
    lng
  };
}

function primaryDocToCustomerAddress(data: Record<string, unknown>): CustomerDocAddress | null {
  return subDocToCustomerAddress(String(data.sourceAddressId ?? data.id ?? "default"), data);
}

/**
 * Rebuild `customers/{uid}.addresses` from `users/{uid}/addresses/*` (and primary `address/default` when empty).
 * Full-array write dedupes by `id` and keeps admin list aligned with the customer app.
 */
export async function mirrorUserAddressesToCustomerDoc(userId: string): Promise<void> {
  if (isBrowserOffline()) return;
  await ensureFirestoreOnline();

  const byId = new Map<string, CustomerDocAddress>();
  const colSnap = await getDocs(collection(db, "users", userId, "addresses"));
  colSnap.forEach((d) => {
    const row = subDocToCustomerAddress(d.id, d.data() as Record<string, unknown>);
    if (row) byId.set(row.id, row);
  });

  if (byId.size === 0) {
    const primarySnap = await safeGetDoc(doc(db, "users", userId, "address", "default"));
    if (primarySnap.exists()) {
      const row = primaryDocToCustomerAddress(primarySnap.data() as Record<string, unknown>);
      if (row) byId.set(row.id, row);
    }
  }

  const addresses = [...byId.values()];
  const customerRef = doc(db, CUSTOMERS_COLLECTION, userId);
  const existing = await safeGetDoc(customerRef);
  const userSnap = await safeGetDoc(doc(db, "users", userId));
  const urow = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : {};

  if (!existing.exists()) {
    await setDoc(
      customerRef,
      {
        uid: userId,
        name: String(urow.name ?? urow.fullName ?? "").trim(),
        email: String(urow.email ?? "").trim(),
        phone: String(urow.phone ?? "").trim(),
        addresses,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalOrders: 0
      },
      { merge: true }
    );
    return;
  }

  await setDoc(
    customerRef,
    {
      addresses,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function readProfileBasics(user: User, userRow: Record<string, unknown> | undefined) {
  const row = userRow;
  const name =
    String(row?.name ?? row?.fullName ?? "").trim() ||
    user.displayName?.trim() ||
    "";
  const email = String(row?.email ?? "").trim() || user.email?.trim() || "";
  const phoneFromRow = String(row?.phone ?? "").trim();
  const phoneFromAuth = user.phoneNumber?.trim() || "";
  const phone = phoneFromAuth || phoneFromRow;
  return { name, email, phone };
}

/**
 * Upsert `customers/{uid}` on sign-in: create if missing (with `totalOrders: 0`), else merge phone/profile + `lastLoginAt`.
 */
export async function upsertCustomerOnLogin(user: User): Promise<void> {
  if (isBrowserOffline()) return;

  await withRetry(
    async () => {
      await ensureFirestoreOnline();
      const uid = user.uid;
      const userRef = doc(db, "users", uid);
      const customerRef = doc(db, CUSTOMERS_COLLECTION, uid);
      const [userSnap, customerSnap] = await Promise.all([safeGetDoc(userRef), safeGetDoc(customerRef)]);
      const basics = readProfileBasics(
        user,
        userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : undefined
      );

      if (!customerSnap.exists()) {
        await setDoc(customerRef, {
          uid,
          name: basics.name,
          email: basics.email,
          phone: basics.phone,
          addresses: [] as CustomerDocAddress[],
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          totalOrders: 0
        });
        return;
      }

      const prev = customerSnap.data() as Record<string, unknown>;
      const prevPhone = String(prev.phone ?? "").trim();
      const phone = basics.phone || prevPhone;
      const totalOrders =
        typeof prev.totalOrders === "number" && Number.isFinite(prev.totalOrders) ? prev.totalOrders : 0;

      await setDoc(
        customerRef,
        {
          uid,
          name: basics.name || String(prev.name ?? ""),
          email: basics.email || String(prev.email ?? ""),
          phone,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          totalOrders
        },
        { merge: true }
      );
    },
    { maxAttempts: 3, baseDelayMs: 400 }
  );
}
