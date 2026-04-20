"use client";

/**
 * Persistent address book for checkout: Firestore `users/{uid}/addresses/{addressId}` + `onSnapshot`.
 * - Subscribes on login; cached in React state (no refetch each render).
 * - `addAddress` / selection / default logic live here.
 * Legacy top-level `addresses` collection → subcollection once; embedded `users.addresses[]` → sub when sub empty.
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
import { auth, db, ensureFirestoreOnline } from "@/lib/firebase";
import {
  deleteUserAddressDoc,
  getUserAddressesOnce,
  migrateEmbeddedAddressesToSubcollection,
  setDefaultUserAddress,
  subscribeUserAddresses,
  updateUserAddressDoc
} from "@/lib/address-book-firestore";
import { saveAddress as saveAddressToFirestore } from "@/lib/user-address-service";
import { deliveryAddressToInput } from "@/lib/save-embedded-address";
import { isValidPincode, type DeliveryAddress, type DeliveryAddressInput } from "@/lib/delivery-address-types";
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

function pickSelectedId(list: DeliveryAddress[], userId: string, previous: string | null): string | null {
  if (previous) {
    if (list.some((a) => a.id === previous)) return previous;
    if (readAuthSelectedId(userId) === previous) return previous;
  }
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
  lastUsedAddressId: string | null;
  selectedAddress: DeliveryAddress | null;
  selectedId: string | null;
  isSelectedAddressSynced: boolean;
  loading: boolean;
  /** Firestore/listener failure or offline hint (empty list + message). */
  addressesLoadError: string | null;
  isAuthenticated: boolean;
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
  const embeddedMigrateDoneRef = useRef(false);

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [lastUsedAddressId, setLastUsedAddressId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkoutDraftAddress, setCheckoutDraftAddressState] = useState<DeliveryAddress | null>(null);
  const [pendingSelectedAddress, setPendingSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [addressesLoadError, setAddressesLoadError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selectedAddressRef = useRef<DeliveryAddress | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /** Address list must not wait on profile load — snapshot drives truth for `users/{uid}/addresses`. */
  const loading = Boolean(uid && !snapshotReady);

  const isAuthenticated = Boolean(uid);

  useEffect(() => {
    if (!uid) {
      setAddresses([]);
      setSnapshotReady(false);
      setAddressesLoadError(null);
      setSelectedId(null);
      setCheckoutDraftAddressState(null);
      setPendingSelectedAddress(null);
      setLastUsedAddressId(null);
      embeddedMigrateDoneRef.current = false;
      return;
    }
    setLastUsedAddressId(readLastUsedAddressId(uid));
    setSnapshotReady(false);
    setAddressesLoadError(null);

    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        await ensureFirestoreOnline();
      } catch {
        /* non-fatal */
      }
      if (cancelled) return;

      const u = subscribeUserAddresses(
        uid,
        (list) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("User:", uid);
            console.log("Fetched address count:", list.length, "Fetched addresses:", list);
          }
          setAddressesLoadError(null);
          setAddresses(list);
          setSnapshotReady(true);
        },
        (err) => {
          console.error("[delivery-address] addresses snapshot error", err);
          const offlineHint =
            /offline|unavailable/i.test(err.message) || err.code === "unavailable";
          setAddressesLoadError(
            offlineHint
              ? "You appear offline or Firestore is unreachable. You can still add an address when you are back online."
              : "Could not load saved addresses. Try refreshing the page."
          );
          setAddresses([]);
          setSnapshotReady(true);
        }
      );
      if (cancelled) {
        u();
        return;
      }
      unsub = u;
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [uid]);

  useEffect(() => {
    if (!pendingSelectedAddress) return;
    if (addresses.some((a) => a.id === pendingSelectedAddress.id)) {
      setPendingSelectedAddress(null);
    }
  }, [addresses, pendingSelectedAddress]);

  useEffect(() => {
    if (!pendingSelectedAddress) return;
    if (selectedId !== pendingSelectedAddress.id) {
      setPendingSelectedAddress(null);
    }
  }, [selectedId, pendingSelectedAddress]);

  /** Legacy collection → subcollection. */
  useEffect(() => {
    if (!uid || profileLoading) return;
    let cancelled = false;
    void (async () => {
      await migrateLegacyTopLevelAddresses(db, uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, profileLoading]);

  /** Embedded array on user doc → subcollection (when sub empty). */
  useEffect(() => {
    if (!uid || !snapshotReady || embeddedMigrateDoneRef.current) return;
    if (addresses.length > 0) {
      embeddedMigrateDoneRef.current = true;
      return;
    }
    const embedded = profile?.addresses ?? [];
    if (embedded.length === 0) {
      embeddedMigrateDoneRef.current = true;
      return;
    }
    void migrateEmbeddedAddressesToSubcollection(uid, embedded)
      .then(() => {
        embeddedMigrateDoneRef.current = true;
      })
      .catch((e) => {
        console.warn("[delivery-address] embedded migration skipped", e);
        embeddedMigrateDoneRef.current = true;
      });
  }, [uid, snapshotReady, addresses.length, profile?.addresses]);

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
    if (!uid) return;
    try {
      await ensureFirestoreOnline();
      const list = await getUserAddressesOnce(uid);
      setAddresses(list);
      setAddressesLoadError(null);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[delivery-address] refreshAddresses failed", e);
      }
      setAddressesLoadError("Could not refresh addresses. Check your connection and try again.");
    }
  }, [uid]);

  const setAddressAsDefault = useCallback(
    async (id: string) => {
      if (!uid || !db) throw new Error("Sign in to manage addresses.");
      await setDefaultUserAddress(uid, id);
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
        const saved = await saveAddressToFirestore(uid, input, {
          email: user?.email ?? null,
          isFirst
        });
        setCheckoutDraftAddressState(null);
        setPendingSelectedAddress(saved);
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
      const user = auth.currentUser;
      await mergeUserProfileBasics(uid, input.name.trim(), input.phone.trim(), user?.email ?? null);
      await updateUserAddressDoc(uid, id, input);
    },
    [uid]
  );

  const removeAddress = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !db) throw new Error("Sign in to manage addresses.");
      const remaining = addresses.filter((a) => a.id !== id);
      await deleteUserAddressDoc(uid, id);
      if (selectedId === id) {
        setCheckoutDraftAddressState(null);
        const next = remaining[0]?.id ?? null;
        setSelectedId(next);
        if (uid) writeAuthSelectedId(uid, next);
      }
    },
    [uid, selectedId, addresses]
  );

  const selectedAddress = useMemo(() => {
    if (!selectedId) return checkoutDraftAddress;
    if (checkoutDraftAddress && checkoutDraftAddress.id === selectedId) return checkoutDraftAddress;
    const fromList = addresses.find((a) => a.id === selectedId);
    if (fromList) return fromList;
    if (pendingSelectedAddress && pendingSelectedAddress.id === selectedId) return pendingSelectedAddress;
    return null;
  }, [addresses, selectedId, checkoutDraftAddress, pendingSelectedAddress]);

  selectedAddressRef.current = selectedAddress;

  const isSelectedAddressSynced = Boolean(selectedAddress && !selectedAddress.id.startsWith("temp-"));

  useEffect(() => {
    if (!online || !uid) return;
    const addr = selectedAddressRef.current;
    if (!addr?.id.startsWith("temp-")) return;
    if (tempSyncInFlightRef.current) return;
    tempSyncInFlightRef.current = true;
    void (async () => {
      try {
        const saved = await saveAddressToFirestore(uid, deliveryAddressToInput(addr), {
          email: auth.currentUser?.email ?? null,
          isFirst: addresses.length === 0
        });
        setCheckoutDraftAddressState(null);
        setPendingSelectedAddress(saved);
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
  }, [online, uid, selectedId, addresses.length]);

  const value = useMemo<DeliveryAddressContextValue>(
    () => ({
      addresses,
      lastUsedAddressId,
      selectedAddress,
      selectedId,
      isSelectedAddressSynced,
      loading,
      addressesLoadError,
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
      addressesLoadError,
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

/** Same as {@link useDeliveryAddress} — persistent saved addresses for checkout. */
export function useAddressBook() {
  return useDeliveryAddress();
}
