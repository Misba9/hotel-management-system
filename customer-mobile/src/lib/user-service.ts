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
import { CUSTOMERS_COLLECTION } from "@/src/lib/customer-doc-sync";
import { db, ensureFirestoreOnline } from "@/src/services/firebase";
import { safeGetDoc } from "@/src/lib/firestore-utils";
import { summarizeOrderItems } from "@shared/utils/order-items-summary";
import { withRetry } from "@shared/utils/retry";

const USERS = "users";
const ORDERS = "orders";

export type DeliveryAddress = {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  pincode?: string;
  lat?: number;
  lng?: number;
};

export type FirestoreUserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  address?: string | null;
  addresses?: DeliveryAddress[];
};

function parseAddressesField(uid: string, raw: unknown): DeliveryAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryAddress[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? `addr-${i}`).trim();
    const addressLine = String(o.addressLine ?? o.street ?? o.address ?? "").trim();
    const city = String(o.city ?? "").trim();
    if (!addressLine) return;
    out.push({
      id,
      label: String(o.label ?? "Home"),
      addressLine,
      city,
      pincode: typeof o.pincode === "string" ? o.pincode : undefined,
      lat: typeof o.lat === "number" ? o.lat : undefined,
      lng: typeof o.lng === "number" ? o.lng : undefined
    });
  });
  return out;
}

export function mapUserProfileFromDoc(uid: string, data: Record<string, unknown>): FirestoreUserProfile {
  const addresses = parseAddressesField(uid, data.addresses);
  return {
    uid: String(data.uid ?? uid),
    name: String(data.name ?? data.fullName ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    role: typeof data.role === "string" ? data.role : undefined,
    address: typeof data.address === "string" ? data.address : null,
    ...(addresses.length > 0 ? { addresses } : {})
  };
}

export async function createUserIfNotExists(user: User): Promise<void> {
  const ref = doc(db, USERS, user.uid);
  await withRetry(
    async () => {
      await ensureFirestoreOnline();
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

export async function mergeUserLoginStamp(user: User): Promise<void> {
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

export type UserOrderSummary = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  trackingId?: string;
  itemsSummary?: string;
};

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
