import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection } from "firebase/firestore";
import { subscribeRecentOrders, subscribeKitchenKdsOrders, type StaffOrderRow } from "../../../services/orders";
import { useNetworkStatus } from "../../hooks/use-network-status";
import { TABLES_COLLECTION } from "../../hooks/use-tables";
import { subscribeFirestoreQuery } from "../../lib/firestore-listener";
import { staffDb } from "../../lib/firebase";

type ManagerModuleContextValue = {
  orders: StaffOrderRow[];
  kitchenOrders: StaffOrderRow[];
  tables: ManagerTableRow[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  isOnline: boolean;
  lastSyncAt: string | null;
  refresh: () => void;
};

const ManagerModuleContext = createContext<ManagerModuleContextValue | null>(null);

const CACHE_KEY = "manager.mobile.module.v1";

type CachePayload = {
  orders: StaffOrderRow[];
  kitchenOrders: StaffOrderRow[];
  tables: ManagerTableRow[];
  savedAt: string;
};

export type ManagerTableUiStatus = "available" | "occupied" | "reserved" | "cleaning";

export type ManagerTableRow = {
  id: string;
  number: number;
  displayName?: string;
  currentOrderId?: string | null;
  uiStatus: ManagerTableUiStatus;
  statusRaw: string;
  assignedWaiterUid?: string;
  assignedWaiterName?: string;
  reservationName?: string;
  reservationNote?: string;
};

function mapTableUiStatus(data: Record<string, unknown>): ManagerTableUiStatus {
  const raw = String(data.status ?? data.managerStatus ?? "").trim().toLowerCase();
  if (["reserved", "booked"].includes(raw)) return "reserved";
  if (["cleaning", "sanitize", "sanitizing"].includes(raw)) return "cleaning";
  if (["occupied", "busy"].includes(raw)) return "occupied";
  if (["free", "available", "open"].includes(raw)) return "available";
  if (data.isReserved === true) return "reserved";
  if (data.isCleaning === true) return "cleaning";
  if (data.isOccupied === true) return "occupied";
  return "available";
}

function mapManagerTableRow(id: string, data: Record<string, unknown>): ManagerTableRow {
  const tableNumber =
    typeof data.tableNumber === "number" && Number.isFinite(data.tableNumber)
      ? data.tableNumber
      : typeof data.number === "number" && Number.isFinite(data.number)
        ? data.number
        : (() => {
            const fromName = parseInt(String(data.name ?? "").replace(/\D/g, ""), 10);
            if (Number.isFinite(fromName)) return fromName;
            const fromId = parseInt(String(id).replace(/\D/g, ""), 10);
            return Number.isFinite(fromId) ? fromId : 0;
          })();
  const displayName = typeof data.name === "string" && data.name.trim() ? data.name.trim() : undefined;
  const currentOrderId =
    typeof data.currentOrderId === "string" ? data.currentOrderId : data.currentOrderId === null ? null : undefined;
  const assignedWaiterUid =
    typeof data.assignedWaiterUid === "string"
      ? data.assignedWaiterUid
      : typeof data.waiterId === "string"
        ? data.waiterId
        : undefined;
  const assignedWaiterName =
    typeof data.assignedWaiterName === "string"
      ? data.assignedWaiterName
      : typeof data.waiterName === "string"
        ? data.waiterName
        : undefined;
  const reservationName =
    typeof data.reservationName === "string"
      ? data.reservationName
      : typeof data.reservedFor === "string"
        ? data.reservedFor
        : undefined;
  const reservationNote = typeof data.reservationNote === "string" ? data.reservationNote : undefined;
  return {
    id,
    number: tableNumber,
    ...(displayName ? { displayName } : {}),
    ...(currentOrderId !== undefined ? { currentOrderId } : {}),
    uiStatus: mapTableUiStatus(data),
    statusRaw: String(data.status ?? ""),
    ...(assignedWaiterUid ? { assignedWaiterUid } : {}),
    ...(assignedWaiterName ? { assignedWaiterName } : {}),
    ...(reservationName ? { reservationName } : {}),
    ...(reservationNote ? { reservationNote } : {})
  };
}

function toMillis(value: unknown): number {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return (value.toDate() as Date).getTime();
    } catch {
      return 0;
    }
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

function sortByNewest(rows: StaffOrderRow[]): StaffOrderRow[] {
  return [...rows].sort((a, b) => {
    const at = toMillis(a.createdAt);
    const bt = toMillis(b.createdAt);
    return bt - at;
  });
}

async function loadCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachePayload>;
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.kitchenOrders) || !Array.isArray(parsed.tables)) {
      return null;
    }
    return {
      orders: parsed.orders as StaffOrderRow[],
      kitchenOrders: parsed.kitchenOrders as StaffOrderRow[],
      tables: parsed.tables as ManagerTableRow[],
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

async function saveCache(payload: CachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort cache only.
  }
}

export function ManagerModuleProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<StaffOrderRow[]>([]);
  const [tables, setTables] = useState<ManagerTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    void (async () => {
      const cache = await loadCache();
      if (!cache) return;
      setOrders(sortByNewest(cache.orders));
      setKitchenOrders(sortByNewest(cache.kitchenOrders));
      setTables(cache.tables);
      setLastSyncAt(cache.savedAt);
      setFromCache(true);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!staffDb) {
      setLoading(false);
      setError("Firestore not initialized.");
      return () => {};
    }

    setLoading(true);
    setError(null);

    let liveOrders: StaffOrderRow[] = [];
    let liveKitchen: StaffOrderRow[] = [];
    let liveTables: ManagerTableRow[] = [];

    const persist = () => {
      const payload: CachePayload = {
        orders: sortByNewest(liveOrders),
        kitchenOrders: sortByNewest(liveKitchen),
        tables: [...liveTables].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id)),
        savedAt: new Date().toISOString()
      };
      setOrders(payload.orders);
      setKitchenOrders(payload.kitchenOrders);
      setTables(payload.tables);
      setLastSyncAt(payload.savedAt);
      setFromCache(false);
      setLoading(false);
      void saveCache(payload);
    };

    const onStreamError = (err: Error) => {
      setLoading(false);
      setError(err.message);
    };

    const unsubOrders = subscribeRecentOrders(
      (rows) => {
        liveOrders = rows;
        persist();
      },
      onStreamError
    );

    const unsubKitchen = subscribeKitchenKdsOrders(
      (rows) => {
        liveKitchen = rows;
        persist();
      },
      onStreamError
    );

    const unsubTables = subscribeFirestoreQuery(
      "managerMobile.tables",
      collection(staffDb, TABLES_COLLECTION),
      (snap) => {
        liveTables = snap.docs.map((docSnap) => mapManagerTableRow(docSnap.id, docSnap.data() as Record<string, unknown>));
        persist();
      },
      onStreamError
    );

    return () => {
      unsubOrders();
      unsubKitchen();
      unsubTables();
    };
  }, [refreshNonce]);

  const value = useMemo<ManagerModuleContextValue>(
    () => ({
      orders,
      kitchenOrders,
      tables,
      loading,
      error,
      fromCache,
      isOnline,
      lastSyncAt,
      refresh: () => setRefreshNonce((prev) => prev + 1)
    }),
    [orders, kitchenOrders, tables, loading, error, fromCache, isOnline, lastSyncAt]
  );

  return <ManagerModuleContext.Provider value={value}>{children}</ManagerModuleContext.Provider>;
}

export function useManagerModule() {
  const ctx = useContext(ManagerModuleContext);
  if (!ctx) throw new Error("useManagerModule must be used inside ManagerModuleProvider");
  return ctx;
}
