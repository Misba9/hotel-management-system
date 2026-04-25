import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp
} from "firebase/firestore";
import { CUSTOMERS_COLLECTION } from "@/lib/customer-doc-sync";
import type { DeliveryAddress } from "@/lib/delivery-address-types";
import { parseAddressesField } from "@/lib/parse-embedded-addresses";
import { db, ensureFirestoreOnline, safeGetDoc } from "@/lib/firebase";
import { summarizeOrderItems } from "@shared/utils/order-items-summary";
import { withRetry } from "@shared/utils/retry";

const USERS = "users";
const ORDERS = "orders";

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export type FirestoreUserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  address?: string | null;
  createdAt?: Timestamp | { toDate?: () => Date } | null;
  updatedAt?: Timestamp | { toDate?: () => Date } | null;
  lastLoginAt?: Timestamp | { toDate?: () => Date } | null;
  /** Saved on `users/{uid}.addresses` — single source with real-time `onSnapshot` on user doc. */
  addresses?: DeliveryAddress[];
};

function parseAddressSummary(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw === "string") {
    const text = raw.trim();
    return text || null;
  }
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const fullAddress = typeof row.fullAddress === "string" ? row.fullAddress.trim() : "";
  const city = typeof row.city === "string" ? row.city.trim() : "";
  const pincode = typeof row.pincode === "string" ? row.pincode.trim() : "";
  const text = [fullAddress, city, pincode].filter(Boolean).join(", ");
  return text || null;
}

export type UserOrderSummary = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  trackingId?: string;
  itemsSummary?: string;
};

/** Map a `users/{uid}` document to `FirestoreUserProfile` (used by getDoc + real-time listeners). */
export function mapUserProfileFromDoc(uid: string, data: Record<string, unknown>): FirestoreUserProfile {
  const name = String(data.name ?? data.fullName ?? "");
  const addresses = parseAddressesField(uid, data.addresses);
  return {
    uid: String(data.uid ?? uid),
    name,
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    role: typeof data.role === "string" ? data.role : undefined,
    address: parseAddressSummary(data.address),
    createdAt: data.createdAt as FirestoreUserProfile["createdAt"],
    updatedAt: data.updatedAt as FirestoreUserProfile["updatedAt"],
    lastLoginAt: data.lastLoginAt as FirestoreUserProfile["lastLoginAt"],
    ...(addresses.length > 0 ? { addresses } : {})
  };
}

/** Create `users/{uid}` only if missing (initial signup / first sign-in). */
export async function createUserIfNotExists(user: User): Promise<void> {
  if (isBrowserOffline()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[user-service] createUserIfNotExists skipped: browser offline.");
    }
    return;
  }
  const ref = doc(db, USERS, user.uid);
  await withRetry(
    async () => {
      const snap = await safeGetDoc(ref);
      if (snap.exists()) return;
      await setDoc(ref, {
        uid: user.uid,
        name: user.displayName?.trim() || "",
        email: user.email || "",
        phone: user.phoneNumber?.trim() || "",
        role: "customer",
        address: null,
        createdAt: serverTimestamp()
      });
    },
    { maxAttempts: 3, baseDelayMs: 500 }
  );
}

/** Merge login timestamp without overwriting edited profile fields. */
export async function mergeUserLoginStamp(user: User): Promise<void> {
  if (isBrowserOffline()) return;
  await withRetry(
    () =>
      setDoc(
        doc(db, USERS, user.uid),
        {
          uid: user.uid,
          name: user.displayName?.trim() || "",
          email: user.email || "",
          phone: user.phoneNumber?.trim() || "",
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ),
    { maxAttempts: 3, baseDelayMs: 500 }
  );
}

/** Ensure user doc exists, record login, return profile for UI. */
export async function loadUserProfileForSession(user: User): Promise<FirestoreUserProfile> {
  await createUserIfNotExists(user);
  await mergeUserLoginStamp(user);
  const p = await getUser(user.uid);
  if (p) return p;
  return {
    uid: user.uid,
    name: user.displayName?.trim() || "",
    email: user.email || "",
    phone: user.phoneNumber?.trim() || ""
  };
}

export async function getUser(uid: string): Promise<FirestoreUserProfile | null> {
  await ensureFirestoreOnline();
  const snap = await safeGetDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return mapUserProfileFromDoc(uid, snap.data() as Record<string, unknown>);
}

export async function updateUser(
  uid: string,
  data: { name: string; email: string; phone: string }
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    name: data.name,
    email: data.email,
    phone: data.phone,
    updatedAt: serverTimestamp()
  });
  await setDoc(
    doc(db, CUSTOMERS_COLLECTION, uid),
    {
      uid,
      name: data.name,
      email: data.email,
      phone: data.phone,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function createdAtToIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === "string" && value) return value;
  return new Date(0).toISOString();
}

/** Orders for the signed-in user (same shape as profile order list). */
export async function fetchUserOrders(uid: string): Promise<UserOrderSummary[]> {
  const q = query(
    collection(db, ORDERS),
    where("userId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const itemsSummary = summarizeOrderItems(data.items);
    return {
      id: d.id,
      amount: Number(data.totalAmount ?? data.total ?? 0),
      status: String(data.status ?? "pending"),
      createdAt: createdAtToIso(data.createdAt),
      address: typeof data.address === "string" ? data.address : undefined,
      trackingId: typeof data.trackingId === "string" ? data.trackingId : undefined,
      itemsSummary: itemsSummary || undefined
    };
  });
}
