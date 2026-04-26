import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { KitchenTicketCard } from "../KitchenTicketCard";
import { printKitchenKot } from "../../services/kitchen-kot-print";
import {
  kitchenAcceptOrder,
  kitchenMarkOrderReady,
  markKitchenTicketPrinted,
  subscribeKitchenKdsOrders,
  type StaffOrderRow
} from "../../services/orders";
import { useNetworkStatus } from "../../src/hooks/use-network-status";

function sortKdsOrders(rows: StaffOrderRow[]): StaffOrderRow[] {
  return [...rows].sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
}

export function KitchenView() {
  const { isOnline } = useNetworkStatus();
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: "accept" | "ready" | "print" } | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const prevIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const pendingAutoPrintIdsRef = useRef<Set<string>>(new Set());
  const autoPrintInFlightRef = useRef<Set<string>>(new Set());
  const highlightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const safeOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (!o || !Array.isArray(o.items)) return false;
        const c = o.canonicalStatus;
        return c === "pending" || c === "preparing";
      }),
    [orders]
  );
  const sorted = useMemo(() => sortKdsOrders(safeOrders), [safeOrders]);

  const markAsNew = useCallback((orderId: string) => {
    setNewOrderIds((prev) => new Set(prev).add(orderId));
    const existing = highlightTimersRef.current[orderId];
    if (existing) clearTimeout(existing);
    highlightTimersRef.current[orderId] = setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      delete highlightTimersRef.current[orderId];
    }, 3000);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!isOnline) {
      setLoading(false);
      setOrders([]);
      bootstrappedRef.current = false;
      prevIdsRef.current = new Set();
      pendingAutoPrintIdsRef.current.clear();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }

    setLoading(true);
    setHasError(false);
    try {
      unsubscribe = subscribeKitchenKdsOrders(
        (next) => {
          const nextIds = new Set(next.map((o) => o.id));
          if (!bootstrappedRef.current) {
            bootstrappedRef.current = true;
            prevIdsRef.current = nextIds;
            setOrders(next);
            setLoading(false);
            return;
          }
          for (const o of next) {
            if (!prevIdsRef.current.has(o.id)) {
              markAsNew(o.id);
              pendingAutoPrintIdsRef.current.add(o.id);
            }
          }
          prevIdsRef.current = nextIds;
          setOrders(next);
          setLoading(false);
        },
        () => {
          setHasError(true);
          setLoading(false);
        }
      );
    } catch {
      setHasError(true);
      setLoading(false);
    }

    return () => {
      Object.values(highlightTimersRef.current).forEach(clearTimeout);
      highlightTimersRef.current = {};
      bootstrappedRef.current = false;
      prevIdsRef.current = new Set();
      pendingAutoPrintIdsRef.current.clear();
      autoPrintInFlightRef.current.clear();
      if (unsubscribe) unsubscribe();
    };
  }, [isOnline, markAsNew]);

  /** Auto KOT once per new ticket (Firestore `printed`); never runs during render. */
  useEffect(() => {
    if (!isOnline || orders.length === 0) return;

    const queue = pendingAutoPrintIdsRef.current;
    const run = async () => {
      for (const o of orders) {
        if (!queue.has(o.id)) continue;
        if (o.canonicalStatus !== "pending" || o.printed === true) {
          queue.delete(o.id);
          continue;
        }
        if (autoPrintInFlightRef.current.has(o.id)) continue;

        queue.delete(o.id);
        autoPrintInFlightRef.current.add(o.id);
        try {
          await printKitchenKot(o, { source: "auto" });
          await markKitchenTicketPrinted(o.id);
        } catch (e) {
          console.error("Kitchen auto-print failed", e);
          queue.add(o.id);
        } finally {
          autoPrintInFlightRef.current.delete(o.id);
        }
      }
    };

    void run();
  }, [orders, isOnline]);

  const runPrint = useCallback(async (order: StaffOrderRow) => {
    setBusy({ id: order.id, action: "print" });
    try {
      await printKitchenKot(order, { source: "manual" });
    } catch {
      Alert.alert("Print failed", "Could not print this ticket. Try again.");
    } finally {
      setBusy(null);
    }
  }, []);

  const runAccept = useCallback(async (order: StaffOrderRow) => {
    setBusy({ id: order.id, action: "accept" });
    try {
      await kitchenAcceptOrder(order);
    } catch {
      Alert.alert("Action failed", "Could not start this ticket. Please try again.");
    } finally {
      setBusy(null);
    }
  }, []);

  const runReady = useCallback(async (order: StaffOrderRow) => {
    setBusy({ id: order.id, action: "ready" });
    try {
      await kitchenMarkOrderReady(order);
    } catch {
      Alert.alert("Action failed", "Could not mark this ticket ready. Please try again.");
    } finally {
      setBusy(null);
    }
  }, []);

  if (!orders) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Kitchen</Text>
      <Text style={styles.sub}>Live queue — new and in-progress tickets (realtime).</Text>
      {!isOnline ? <Text style={styles.banner}>No connection</Text> : null}
      {hasError ? <Text style={styles.state}>Something went wrong</Text> : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#cbd5e1" />
          <Text style={styles.state}>Loading tickets...</Text>
        </View>
      ) : null}
      <FlatList
        data={sorted}
        keyExtractor={(o) => o.id}
        extraData={busy}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <KitchenTicketCard
            order={item}
            busy={busy?.id === item.id ? busy.action : null}
            onPrint={() => void runPrint(item)}
            onAccept={() => void runAccept(item)}
            onMarkReady={() => void runReady(item)}
            isNew={newOrderIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No tickets in queue</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a" },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 16
  },
  sub: {
    fontSize: 14,
    color: "#94a3b8",
    paddingHorizontal: 16,
    marginBottom: 8,
    lineHeight: 20
  },
  banner: {
    color: "#f8fafc",
    backgroundColor: "#334155",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
    fontWeight: "700"
  },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  state: { color: "#cbd5e1", paddingHorizontal: 16, marginBottom: 8, fontSize: 14 },
  list: { paddingBottom: 32 },
  empty: { textAlign: "center", marginTop: 48, color: "#64748b", fontSize: 16 }
});
