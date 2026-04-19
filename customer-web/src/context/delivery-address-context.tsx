"use client";

/**
 * Delivery addresses live on `users/{uid}.addresses` (array) — same document as profile.
 * Real-time updates come from `UserProfileProvider` (`onSnapshot` on `users/{uid}`).
 * One-time migration: legacy `addresses` collection → subcollection → embedded array.
 */

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
import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Firestore
} from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { useUserProfile } from "@/context/user-profile-context";
import { auth, db } from "@/lib/firebase";
import { sortAddressesByRecentCreated } from "@/lib/address-suggestions";
import { isValidPincode, type DeliveryAddress, type DeliveryAddressInput } from "@/lib/delivery-address-types";
import {
  getEmbeddedAddressesFromUserDoc,
  replaceUserEmbeddedAddresses,
  saveAddress,
  syncTempAddressToAccount
} from "@/lib/save-embedded-address";
import { useOnlineStatus } from "@/hooks/use-online-status";

const AUTH_SELECTED_PREFIX = "nausheen_delivery_selected_";
const LAST_USED_PREFIX = "nausheen_last_used_addr_";

function lastUsedStorageKey(uid: string) {
  return `${LAST_USED_PREFIX}${uid}`;
}

function readLastUsedAddressId(uid: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(lastUsedStorageKey(uid));
  } catch {
    return null;
  }
}

function writeLastUsedAddressId(uid: string, id: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = lastUsedStorageKey(uid);
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
const LEGACY_COLLECTION = "addresses";
const MIGRATION_FLAG = "nausheen_legacy_addr_migrated_";
const SUB_TO_EMBED_KEY = "nausheen_sub_to_embed_";

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

function parseLabel(raw: unknown): DeliveryAddress["label"] {
  const s = String(raw ?? "Home").trim();
  if (s === "Work" || s === "Other") return s;
  return "Home";
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
  return {
    id,
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

function pickSelectedId(list: DeliveryAddress[], userId: string, previous: string | null): string | null {
  if (previous && list.some((a) => a.id === previous)) return previous;
  const stored = readAuthSelectedId(userId);
  if (stored && list.some((a) => a.id === stored)) return stored;
  const def = list.find((a) => a.isDefault);
  if (def) return def.id;
  return list[0]?.id ?? null;
}

function validateAddressInput(input: DeliveryAddressInput): string | null {
  if (!input.addressLine.trim()) return "Address line is required.";
  if (!input.phone.trim()) return "Phone is required.";
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "Enter a valid phone number.";
  if (!isValidPincode(input.pincode)) return "Enter a valid 6-digit PIN code.";
  return null;
}

async function migrateLegacyTopLevelAddresses(firestore: Firestore, uid: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(`${MIGRATION_FLAG}${uid}`)) return;
  try {
    const q = query(collection(firestore, LEGACY_COLLECTION), where("userId", "==", uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      sessionStorage.setItem(`${MIGRATION_FLAG}${uid}`, "1");
      return;
    }
    let batch = writeBatch(firestore);
    let ops = 0;
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const dest = doc(firestore, "users", uid, "addresses", d.id);
      batch.set(
        dest,
        {
          userId: uid,
          name: String(data.name ?? ""),
          phone: String(data.phone ?? ""),
          addressLine: String(data.addressLine ?? data.address ?? ""),
          landmark: String(data.landmark ?? ""),
          city: String(data.city ?? ""),
          pincode: String(data.pincode ?? ""),
          label: parseLabel(data.label),
          isDefault: Boolean(data.isDefault),
          createdAt: data.createdAt ?? serverTimestamp(),
          updatedAt: data.updatedAt ?? serverTimestamp()
        },
        { merge: true }
      );
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(firestore);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    sessionStorage.setItem(`${MIGRATION_FLAG}${uid}`, "1");
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[delivery-address] legacy migration skipped", e);
    }
  }
}

/** Copies `users/{uid}/addresses/*` into `users/{uid}.addresses` once. */
async function migrateSubcollectionToEmbedded(uid: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(`${SUB_TO_EMBED_KEY}${uid}`)) return;
  try {
    const snap = await getDocs(collection(db, "users", uid, "addresses"));
    if (snap.empty) {
      sessionStorage.setItem(`${SUB_TO_EMBED_KEY}${uid}`, "1");
      return;
    }
    const list: DeliveryAddress[] = [];
    snap.forEach((d) => {
      const row = docToAddress(d.id, uid, d.data() as Record<string, unknown>);
      if (row) list.push(row);
    });
    if (list.length === 0) {
      sessionStorage.setItem(`${SUB_TO_EMBED_KEY}${uid}`, "1");
      return;
    }
    const sorted = sortAddressesByRecentCreated(list);
    const existing = await getEmbeddedAddressesFromUserDoc(uid);
    if (existing.length > 0) {
      sessionStorage.setItem(`${SUB_TO_EMBED_KEY}${uid}`, "1");
      return;
    }
    await replaceUserEmbeddedAddresses(uid, sorted);
    sessionStorage.setItem(`${SUB_TO_EMBED_KEY}${uid}`, "1");
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[delivery-address] subcollection → embedded migration skipped", e);
    }
  }
}

async function mergeUserProfileBasics(uid: string, name: string, phone: string, email: string | null) {
  if (!db) return;
  const payload: Record<string, unknown> = {
    name: name.trim(),
    phone: phone.trim(),
    updatedAt: serverTimestamp()
  };
  if (email?.trim()) payload.email = email.trim();
  await setDoc(doc(db, "users", uid), payload, { merge: true });
}

type DeliveryAddressContextValue = {
  addresses: DeliveryAddress[];
  /** Last address the user tapped for delivery (persisted in `localStorage` per uid). */
  lastUsedAddressId: string | null;
  selectedAddress: DeliveryAddress | null;
  selectedId: string | null;
  /** False when the chosen address is a `temp-*` local-only row (not yet in Firestore). */
  isSelectedAddressSynced: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  /** Session-only address when Firestore save fails — still allows checkout. */
  checkoutDraftAddress: DeliveryAddress | null;
  setCheckoutDraftAddress: (address: DeliveryAddress | null) => void;
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
  const uid = useAuth().user?.uid ?? null;
  const { profile, loading: profileLoading } = useUserProfile();
  const online = useOnlineStatus();
  const tempSyncInFlightRef = useRef(false);

  const addresses = useMemo(
    () => sortAddressesByRecentCreated(profile?.addresses ?? []),
    [profile?.addresses]
  );

  const [lastUsedAddressId, setLastUsedAddressId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkoutDraftAddress, setCheckoutDraftAddressState] = useState<DeliveryAddress | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loading = Boolean(uid && profileLoading);

  const isAuthenticated = Boolean(uid);

  useEffect(() => {
    if (!uid) {
      setSelectedId(null);
      setCheckoutDraftAddressState(null);
      setLastUsedAddressId(null);
      return;
    }
    setLastUsedAddressId(readLastUsedAddressId(uid));
  }, [uid]);

  /** Legacy + subcollection → embedded (runs once per session when embedded is still empty). */
  useEffect(() => {
    if (!uid || profileLoading) return;
    if (profile?.addresses && profile.addresses.length > 0) return;
    let cancelled = false;
    void (async () => {
      await migrateLegacyTopLevelAddresses(db, uid);
      if (cancelled) return;
      await migrateSubcollectionToEmbedded(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, profileLoading, profile?.addresses?.length]);

  useEffect(() => {
    if (!uid) return;
    const prev = selectedIdRef.current;
    if (prev?.startsWith("temp-")) return;
    const next = pickSelectedId(addresses, uid, prev);
    if (next !== prev) {
      setSelectedId(next);
      if (next) writeAuthSelectedId(uid, next);
      else writeAuthSelectedId(uid, null);
    }
  }, [uid, addresses]);

  const setCheckoutDraftAddress = useCallback(
    (address: DeliveryAddress | null) => {
      setCheckoutDraftAddressState(address);
      if (address && uid) {
        setSelectedId(address.id);
        writeAuthSelectedId(uid, address.id);
        writeLastUsedAddressId(uid, address.id);
        setLastUsedAddressId(address.id);
      }
      if (!address && uid) {
        const next = pickSelectedId(addresses, uid, null);
        setSelectedId(next);
        if (next) writeAuthSelectedId(uid, next);
        else writeAuthSelectedId(uid, null);
      }
    },
    [uid, addresses]
  );

  const selectAddress = useCallback(
    (id: string) => {
      if (!uid) return;
      const isSaved = addresses.some((a) => a.id === id);
      if (isSaved) {
        setCheckoutDraftAddressState(null);
      }
      setSelectedId(id);
      writeAuthSelectedId(uid, id);
      writeLastUsedAddressId(uid, id);
      setLastUsedAddressId(id);
    },
    [uid, addresses]
  );

  const clearSelection = useCallback(() => {
    setCheckoutDraftAddressState(null);
    setSelectedId(null);
    if (uid) writeAuthSelectedId(uid, null);
  }, [uid]);

  const refreshAddresses = useCallback(async () => {
    return Promise.resolve();
  }, []);

  const setAddressAsDefault = useCallback(
    async (id: string) => {
      if (!uid || !db) throw new Error("Sign in to manage addresses.");
      let list = await getEmbeddedAddressesFromUserDoc(uid);
      if (list.length === 0) return;
      list = list.map((a) => ({ ...a, isDefault: a.id === id }));
      await replaceUserEmbeddedAddresses(uid, list);
      setSelectedId(id);
      writeAuthSelectedId(uid, id);
    },
    [uid]
  );

  const addAddress = useCallback(
    async (input: DeliveryAddressInput): Promise<DeliveryAddress> => {
      if (!uid) throw new Error("Sign in to save addresses.");
      if (!db) throw new Error("Firestore is not ready.");
      const err = validateAddressInput(input);
      if (err) throw new Error(err);

      const user = auth.currentUser;
      const isFirst = addresses.length === 0;

      try {
        const saved = await saveAddress(uid, input, {
          email: user?.email ?? null,
          isFirst
        });
        setCheckoutDraftAddressState(null);
        setSelectedId(saved.id);
        writeAuthSelectedId(uid, saved.id);
        writeLastUsedAddressId(uid, saved.id);
        setLastUsedAddressId(saved.id);
        return saved;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[delivery-address] addAddress failed", error);
        }
        if (error instanceof FirebaseError) {
          if (error.code === "permission-denied") {
            throw new Error("Permission denied. Sign out and sign in again, then retry.");
          }
          if (error.code === "unavailable") {
            throw new Error("Network unavailable. Check your connection and try again.");
          }
        }
        if (error instanceof Error) throw error;
        throw new Error("Could not save address right now. Please try again.");
      }
    },
    [uid, addresses.length]
  );

  const updateAddress = useCallback(
    async (id: string, input: DeliveryAddressInput): Promise<void> => {
      if (!uid || !db) throw new Error("Sign in to manage addresses.");
      const err = validateAddressInput(input);
      if (err) throw new Error(err);
      const label = input.label ?? "Home";
      const user = auth.currentUser;
      await mergeUserProfileBasics(uid, input.name.trim(), input.phone.trim(), user?.email ?? null);

      let list = await getEmbeddedAddressesFromUserDoc(uid);
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Address not found.");
      const now = new Date().toISOString();
      list[idx] = {
        ...list[idx],
        label: label as DeliveryAddress["label"],
        name: input.name.trim(),
        phone: input.phone.trim(),
        addressLine: input.addressLine.trim(),
        landmark: input.landmark.trim(),
        city: input.city.trim(),
        pincode: input.pincode.trim(),
        ...(typeof input.lat === "number" && Number.isFinite(input.lat) ? { lat: input.lat } : {}),
        ...(typeof input.lng === "number" && Number.isFinite(input.lng) ? { lng: input.lng } : {}),
        updatedAt: now
      };
      await replaceUserEmbeddedAddresses(uid, list);
    },
    [uid]
  );

  const removeAddress = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !db) throw new Error("Sign in to manage addresses.");
      let list = await getEmbeddedAddressesFromUserDoc(uid);
      const target = list.find((a) => a.id === id);
      if (!target) return;
      const wasDefault = target.isDefault;
      list = list.filter((a) => a.id !== id);
      if (wasDefault && list.length > 0) {
        list = list.map((a, i) => ({ ...a, isDefault: i === 0 }));
      }
      await replaceUserEmbeddedAddresses(uid, list);
      if (selectedId === id) {
        setCheckoutDraftAddressState(null);
        const next = list[0]?.id ?? null;
        setSelectedId(next);
        if (uid) writeAuthSelectedId(uid, next);
      }
    },
    [uid, selectedId]
  );

  const selectedAddress = useMemo(() => {
    if (!selectedId) return checkoutDraftAddress;
    if (checkoutDraftAddress && checkoutDraftAddress.id === selectedId) return checkoutDraftAddress;
    return addresses.find((a) => a.id === selectedId) ?? null;
  }, [addresses, selectedId, checkoutDraftAddress]);

  const isSelectedAddressSynced = Boolean(selectedAddress && !selectedAddress.id.startsWith("temp-"));

  /** When back online, push `temp-*` address to Firestore so it syncs to the account. */
  useEffect(() => {
    if (!online || !uid) return;
    const addr = selectedAddress;
    if (!addr?.id.startsWith("temp-")) return;
    if (tempSyncInFlightRef.current) return;
    tempSyncInFlightRef.current = true;
    void (async () => {
      try {
        const saved = await syncTempAddressToAccount(uid, addr, {
          email: auth.currentUser?.email ?? null,
          isFirst: addresses.length === 0
        });
        setCheckoutDraftAddressState(null);
        setSelectedId(saved.id);
        writeAuthSelectedId(uid, saved.id);
        writeLastUsedAddressId(uid, saved.id);
        setLastUsedAddressId(saved.id);
      } catch (e) {
        console.log("Temp address sync skipped (offline or error):", e);
      } finally {
        tempSyncInFlightRef.current = false;
      }
    })();
  }, [online, uid, selectedAddress, addresses.length]);

  const value = useMemo<DeliveryAddressContextValue>(
    () => ({
      addresses,
      lastUsedAddressId,
      selectedAddress,
      selectedId,
      isSelectedAddressSynced,
      loading,
      isAuthenticated,
      checkoutDraftAddress,
      setCheckoutDraftAddress,
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
      lastUsedAddressId,
      selectedAddress,
      selectedId,
      isSelectedAddressSynced,
      loading,
      isAuthenticated,
      checkoutDraftAddress,
      setCheckoutDraftAddress,
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
