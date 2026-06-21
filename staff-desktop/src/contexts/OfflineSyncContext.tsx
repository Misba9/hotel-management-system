import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { syncCachedOrderToCloud } from "@/lib/orders-service";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";
import { playNewOrderSound } from "@/lib/kds-utils";
import type { OfflineSyncStatus } from "../../electron/main-types";

type OfflineSyncContextValue = {
  status: OfflineSyncStatus;
  syncNow: () => Promise<void>;
  cacheOrder: (payload: Record<string, unknown>) => Promise<number>;
};

const defaultStatus: OfflineSyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OfflineSyncStatus>(defaultStatus);

  const refreshStatus = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    const next = await getDesktopApi().getOfflineStatus();
    setStatus(next);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    const api = getDesktopApi();
    await api.notifySyncStarted();
    try {
      const pending = await api.listPendingOrders();

      for (const row of pending) {
        try {
          const payload = JSON.parse(row.payload) as Record<string, unknown>;
          await syncCachedOrderToCloud(payload);
          await api.markOrderSynced(row.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "sync_failed";
          await api.markOrderFailed(row.id, message);
        }
      }
      await api.notifySyncFinished({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync_failed";
      await api.notifySyncFinished({ ok: false, error: message });
    } finally {
      await refreshStatus();
    }
  }, [refreshStatus]);

  const cacheOrder = useCallback(async (payload: Record<string, unknown>) => {
    if (!isDesktopRuntime()) return 0;
    const result = await getDesktopApi().enqueueOfflineOrder(payload);
    await refreshStatus();
    return result.id;
  }, [refreshStatus]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    const api = getDesktopApi();

    void refreshStatus();
    const unsubStatus = api.onOfflineStatus(setStatus);
    const unsubSync = api.onSyncRequest(() => {
      void syncNow();
    });

    const handleOnline = () => {
      void api.setOnline(true);
      void syncNow();
    };
    const handleOffline = () => {
      void api.setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void api.setOnline(navigator.onLine);

    return () => {
      unsubStatus();
      unsubSync();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshStatus, syncNow]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    return getDesktopApi().onNewOrderSound(() => {
      void getDesktopApi()
        .getSettings()
        .then((settings) => {
          if (settings.soundNotifications) playNewOrderSound();
        })
        .catch(() => playNewOrderSound());
    });
  }, []);

  const value = useMemo(
    () => ({ status, syncNow, cacheOrder }),
    [status, syncNow, cacheOrder]
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  return ctx;
}
