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
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { pingPlatformApi } from "@/lib/api-client";
import { getStaffDesktopFirestore } from "@/lib/firebase";
import { playNewOrderSound } from "@/lib/kds-utils";
import { getDesktopApi, isDesktopRuntime } from "@/lib/desktop-api";

export type CloudConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

type CloudConnectionContextValue = {
  online: boolean;
  connectionState: CloudConnectionState;
  realtimeReady: boolean;
  lastConnectedAt: string | null;
  reconnect: () => Promise<void>;
};

const CloudConnectionContext = createContext<CloudConnectionContextValue | null>(null);

const KITCHEN_ACTIVE_STATUSES = ["pending", "preparing", "placed", "confirmed", "accepted"];

export function CloudConnectionProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [connectionState, setConnectionState] = useState<CloudConnectionState>("idle");
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const connectCloud = useCallback(async () => {
    if (!profile) {
      setConnectionState("idle");
      setRealtimeReady(false);
      return;
    }

    setConnectionState((prev) => (prev === "connected" ? "reconnecting" : "connecting"));

    const db = await getStaffDesktopFirestore();
    if (!db) {
      setConnectionState("disconnected");
      setRealtimeReady(false);
      return;
    }

    if (online) {
      await pingPlatformApi().catch(() => undefined);
    }

    setConnectionState("connected");
    setRealtimeReady(true);
    setLastConnectedAt(new Date().toISOString());
  }, [profile, online]);

  const reconnect = useCallback(async () => {
    await connectCloud();
  }, [connectCloud]);

  useEffect(() => {
    if (!profile) {
      setConnectionState("idle");
      setRealtimeReady(false);
      bootstrappedRef.current = false;
      knownOrderIdsRef.current = new Set();
      return;
    }

    void connectCloud();
  }, [profile, connectCloud]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void connectCloud();
    };
    const handleOffline = () => {
      setOnline(false);
      setConnectionState("disconnected");
      setRealtimeReady(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectCloud]);

  useEffect(() => {
    if (!profile || !realtimeReady) return;

    let unsub = () => {};
    void (async () => {
      const db = await getStaffDesktopFirestore();
      if (!db) return;

      const ordersQuery = query(
        collection(db, "orders"),
        where("status", "in", KITCHEN_ACTIVE_STATUSES),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsub = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const ids = snapshot.docs.map((docSnap) => docSnap.id);
          if (!bootstrappedRef.current) {
            bootstrappedRef.current = true;
            knownOrderIdsRef.current = new Set(ids);
            return;
          }

          for (const change of snapshot.docChanges()) {
            if (change.type !== "added") continue;
            if (knownOrderIdsRef.current.has(change.doc.id)) continue;
            knownOrderIdsRef.current.add(change.doc.id);

            if (profile.role === "kitchen" || profile.role === "manager" || profile.role === "admin" || profile.role === "cashier") {
              const playSound = () => {
                if (isDesktopRuntime()) {
                  void getDesktopApi()
                    .getSettings()
                    .then((settings) => {
                      if (settings.soundNotifications) playNewOrderSound();
                    })
                    .catch(() => playNewOrderSound());
                } else {
                  playNewOrderSound();
                }
              };
              playSound();
            }
          }

          knownOrderIdsRef.current = new Set(ids);
        },
        () => {
          setConnectionState("reconnecting");
          window.setTimeout(() => {
            void connectCloud();
          }, 2000);
        }
      );
    })();

    return () => {
      unsub();
      bootstrappedRef.current = false;
      knownOrderIdsRef.current = new Set();
    };
  }, [profile, realtimeReady, connectCloud]);

  const value = useMemo<CloudConnectionContextValue>(
    () => ({
      online,
      connectionState,
      realtimeReady,
      lastConnectedAt,
      reconnect
    }),
    [online, connectionState, realtimeReady, lastConnectedAt, reconnect]
  );

  return <CloudConnectionContext.Provider value={value}>{children}</CloudConnectionContext.Provider>;
}

export function useCloudConnection(): CloudConnectionContextValue {
  const ctx = useContext(CloudConnectionContext);
  if (!ctx) throw new Error("useCloudConnection must be used within CloudConnectionProvider");
  return ctx;
}
