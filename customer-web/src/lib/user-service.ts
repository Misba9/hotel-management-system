import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
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
import { db } from "@/lib/firebase";
import { summarizeOrderItems } from "@shared/utils/order-items-summary";

const USERS = "users";
const ORDERS = "orders";

export type FirestoreUserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  createdAt?: Timestamp | { toDate?: () => Date } | null;
  updatedAt?: Timestamp | { toDate?: () => Date } | null;
  lastLoginAt?: Timestamp | { toDate?: () => Date } | null;
};

export type UserOrderSummary = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  trackingId?: string;
  itemsSummary?: string;
};

function mapUserDoc(uid: string, data: Record<string, unknown>): FirestoreUserProfile {
  const name = String(data.name ?? data.fullName ?? "");
  return {
    uid: String(data.uid ?? uid),
    name,
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    createdAt: data.createdAt as FirestoreUserProfile["createdAt"],
    updatedAt: data.updatedAt as FirestoreUserProfile["updatedAt"],
    lastLoginAt: data.lastLoginAt as FirestoreUserProfile["lastLoginAt"]
  };
}

/** Create `users/{uid}` only if missing (initial signup / first sign-in). */
export async function createUserIfNotExists(user: User): Promise<void> {
  const ref = doc(db, USERS, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: user.displayName?.trim() || "",
    email: user.email || "",
    phone: user.phoneNumber?.trim() || "",
    createdAt: serverTimestamp()
  });
}

/** Merge login timestamp without overwriting edited profile fields. */
export async function mergeUserLoginStamp(user: User): Promise<void> {
  await setDoc(
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
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return mapUserDoc(uid, snap.data() as Record<string, unknown>);
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
