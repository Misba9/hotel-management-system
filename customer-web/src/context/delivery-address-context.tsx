"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { DeliveryAddress, DeliveryAddressInput } from "@/lib/delivery-address-types";
import { withRetry } from "@shared/utils/retry";

const ADDRESSES = "addresses";
const AUTH_SELECTED_PREFIX = "nausheen_delivery_selected_";

function authSelectedKey(uid: string) {
  return `${AUTH_SELECTED_PREFIX}${uid}`;
}

function readAuthSelectedId(uid: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(authSelectedKey(uid));
}

function writeAuthSelectedId(uid: string, id: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = authSelectedKey(uid);
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function docToAddress(id: string, fallbackUserId: string, data: Record<string, unknown>): DeliveryAddress | null {
  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const addressLine = String(data.addressLine ?? data.address ?? "").trim();
  const city = String(data.city ?? "").trim() || "Local";
  const landmark = String(data.landmark ?? "").trim();
  const pincode = String(data.pincode ?? "").trim();
  if (!name || !phone || !addressLine || !pincode) return null;
  let createdAt: string | undefined;
  let updatedAt: string | undefined;
  const c = data.createdAt;
  const u = data.updatedAt;
  if (c instanceof Timestamp) createdAt = c.toDate().toISOString();
  else if (typeof c === "string") createdAt = c;
  if (u instanceof Timestamp) updatedAt = u.toDate().toISOString();
  else if (typeof u === "string") updatedAt = u;
  return {
    id,
    userId: String(data.userId ?? fallbackUserId),
    name,
    phone,
    addressLine,
    landmark,
    city,
    pincode,
    isDefault: Boolean(data.isDefault),
    createdAt,
    updatedAt
  };
}

function pickSelectedId(list: DeliveryAddress[], userId: string): string | null {
  const stored = readAuthSelectedId(userId);
  if (stored && list.some((a) => a.id === stored)) return stored;
  const def = list.find((a) => a.isDefault);
  if (def) return def.id;
  return list[0]?.id ?? null;
}

type DeliveryAddressContextValue = {
  addresses: DeliveryAddress[];
  selectedAddress: DeliveryAddress | null;
  selectedId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  selectAddress: (id: string) => void;
  clearSelection: () => void;
  setAddressAsDefault: (id: string) => Promise<void>;
  addAddress: (input: DeliveryAddressInput) => Promise<DeliveryAddress>;
  updateAddress: (id: string, input: DeliveryAddressInput) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  refreshAddresses: () => Promise<void>;
};

const DeliveryAddressContext = createContext<DeliveryAddressContextValue | null>(null);

export function DeliveryAddressProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeLoadKeyRef = useRef(0);
  const loadedUidRef = useRef<string | null>(null);
  const addressesCountRef = useRef(0);

  const isAuthenticated = Boolean(uid);

  useEffect(() => {
    addressesCountRef.current = addresses.length;
  }, [addresses.length]);

  const loadFirebaseAddresses = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    if (!db) {
      console.error("[delivery-address] Firestore db is not initialized.");
      return;
    }
    const loadKey = ++activeLoadKeyRef.current;
    try {
      const q = query(collection(db, ADDRESSES), where("userId", "==", userId));
      const snap = await withRetry(() => getDocs(q), { maxAttempts: 3 });
      if (loadKey !== activeLoadKeyRef.current) return;
      const list: DeliveryAddress[] = [];
      snap.forEach((d) => {
        const row = docToAddress(d.id, userId, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      });
      list.sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));
      setAddresses(list);
      const next = pickSelectedId(list, userId);
      setSelectedId(next);
      loadedUidRef.current = userId;
      if (next) writeAuthSelectedId(userId, next);
      else writeAuthSelectedId(userId, null);
    } catch (e) {
      if (loadKey !== activeLoadKeyRef.current) return;
      console.error("[delivery-address] Failed to load addresses.", e);
      setAddresses([]);
    }
  }, []);

  const refreshAddresses = useCallback(async () => {
    if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) return;
    setLoading(true);
    try {
      await loadFirebaseAddresses(uid);
    } finally {
      setLoading(false);
    }
  }, [uid, loadFirebaseAddresses]);

  const setAddressAsDefault = useCallback(
    async (id: string) => {
      if (!uid) throw new Error("Sign in to manage addresses.");
      if (!db) throw new Error("Firestore is not ready.");
      const q = query(collection(db, ADDRESSES), where("userId", "==", uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(d.ref, {
          isDefault: d.id === id,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      setSelectedId(id);
      writeAuthSelectedId(uid, id);
      await loadFirebaseAddresses(uid);
    },
    [uid, loadFirebaseAddresses]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      try {
        if (user) {
          setUid(user.uid);
          if (loadedUidRef.current === user.uid && addressesCountRef.current > 0) return;
          await loadFirebaseAddresses(user.uid);
        } else {
          setUid(null);
          setAddresses([]);
          setSelectedId(null);
          loadedUidRef.current = null;
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadFirebaseAddresses]);

  const selectAddress = useCallback(
    (id: string) => {
      if (!uid) return;
      setSelectedId(id);
      writeAuthSelectedId(uid, id);
    },
    [uid]
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    if (uid) writeAuthSelectedId(uid, null);
  }, [uid]);

  const updateAddress = useCallback(
    async (id: string, input: DeliveryAddressInput): Promise<void> => {
      if (!uid) throw new Error("Sign in to manage addresses.");
      if (!db) throw new Error("Firestore is not ready.");
      const row: DeliveryAddressInput = {
        name: input.name.trim(),
        phone: input.phone.trim(),
        addressLine: input.addressLine.trim(),
        landmark: input.landmark.trim(),
        city: input.city.trim(),
        pincode: input.pincode.trim()
      };
      await updateDoc(doc(db, ADDRESSES, id), {
        ...row,
        updatedAt: serverTimestamp()
      });
      await loadFirebaseAddresses(uid);
    },
    [uid, loadFirebaseAddresses]
  );

  const removeAddress = useCallback(
    async (id: string): Promise<void> => {
      if (!uid) throw new Error("Sign in to manage addresses.");
      if (!db) throw new Error("Firestore is not ready.");
      const target = addresses.find((a) => a.id === id);
      await deleteDoc(doc(db, ADDRESSES, id));
      const remaining = addresses.filter((a) => a.id !== id);
      if (target?.isDefault && remaining.length > 0) {
        await updateDoc(doc(db, ADDRESSES, remaining[0].id), {
          isDefault: true,
          updatedAt: serverTimestamp()
        });
      }
      if (selectedId === id) {
        setSelectedId(null);
        writeAuthSelectedId(uid, null);
      }
      await loadFirebaseAddresses(uid);
    },
    [uid, addresses, selectedId, loadFirebaseAddresses]
  );

  const addAddress = useCallback(
    async (input: DeliveryAddressInput): Promise<DeliveryAddress> => {
      if (!uid) throw new Error("Sign in to save addresses.");
      if (!db) throw new Error("Firestore is not ready.");
      try {
        const row: DeliveryAddressInput = {
          name: input.name.trim(),
          phone: input.phone.trim(),
          addressLine: input.addressLine.trim(),
          landmark: input.landmark.trim(),
          city: input.city.trim(),
          pincode: input.pincode.trim()
        };
        const q = query(collection(db, ADDRESSES), where("userId", "==", uid));
        const existing = await withRetry(() => getDocs(q), { maxAttempts: 3 });
        const isFirst = existing.empty;
        const ref = await withRetry(
          () =>
            addDoc(collection(db, ADDRESSES), {
              userId: uid,
              ...row,
              isDefault: isFirst,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }),
          { maxAttempts: 3 }
        );
        if (isFirst) {
          setSelectedId(ref.id);
          writeAuthSelectedId(uid, ref.id);
        }
        await loadFirebaseAddresses(uid);
        const created: DeliveryAddress = {
          id: ref.id,
          userId: uid,
          ...row,
          isDefault: isFirst
        };
        return created;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[delivery-address] addAddress failed", error);
        }
        throw new Error("Could not save address right now. Please try again.");
      }
    },
    [uid, loadFirebaseAddresses]
  );

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedId) ?? null,
    [addresses, selectedId]
  );

  const value = useMemo<DeliveryAddressContextValue>(
    () => ({
      addresses,
      selectedAddress,
      selectedId,
      loading,
      isAuthenticated,
      selectAddress,
      clearSelection,
      setAddressAsDefault,
      addAddress,
      updateAddress,
      removeAddress,
      refreshAddresses
    }),
    [
      addresses,
      selectedAddress,
      selectedId,
      loading,
      isAuthenticated,
      selectAddress,
      clearSelection,
      setAddressAsDefault,
      addAddress,
      updateAddress,
      removeAddress,
      refreshAddresses
    ]
  );

  return <DeliveryAddressContext.Provider value={value}>{children}</DeliveryAddressContext.Provider>;
}

export function useDeliveryAddress() {
  const ctx = useContext(DeliveryAddressContext);
  if (!ctx) throw new Error("useDeliveryAddress must be used within DeliveryAddressProvider");
  return ctx;
}
