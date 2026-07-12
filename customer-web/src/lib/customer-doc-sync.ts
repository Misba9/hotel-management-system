import type { User } from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import {
  db,
  ensureFirestoreOnline,
  isFirestoreInternalAssertionError,
  isOfflineLikeFirestoreError,
  logFirebaseDiagnostics,
  safeGetDoc
} from "@/lib/firebase";
import { withRetry } from "@shared/utils/retry";

function shouldRetryFirestoreWrite(error: unknown): boolean {
  if (isFirestoreInternalAssertionError(error)) return false;
  return isOfflineLikeFirestoreError(error);
}

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

  try {
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

    // Write-only merge — no customer/user getDoc (avoids Firestore ca9 on login).
    await setDoc(
      doc(db, CUSTOMERS_COLLECTION, userId),
      {
        uid: userId,
        addresses: [...byId.values()],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    if (isFirestoreInternalAssertionError(error)) {
      logFirebaseDiagnostics("mirrorUserAddressesToCustomerDoc aborted — internal assertion", {
        userId,
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }
    throw error;
  }
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
 * Upsert `customers/{uid}` on sign-in via write-only merge (Auth profile fields only).
 * Avoids cold `getDoc` that triggers Firestore ca9 after Google Sign-In.
 */
export async function upsertCustomerOnLogin(user: User): Promise<void> {
  if (isBrowserOffline()) return;

  const basics = readProfileBasics(user, undefined);

  await withRetry(
    async () => {
      await ensureFirestoreOnline();
      const uid = user.uid;
      await setDoc(
        doc(db, CUSTOMERS_COLLECTION, uid),
        {
          uid,
          name: basics.name,
          email: basics.email,
          phone: basics.phone,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    },
    { maxAttempts: 2, baseDelayMs: 400, shouldRetry: shouldRetryFirestoreWrite }
  );
}
