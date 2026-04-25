import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { KitchenTicketCard, type KitchenTicketAction } from "../KitchenTicketCard";
import { printKitchenTicketForStaffOrder } from "../../services/restaurant-orders";
import {
  kitchenAcceptOrder,
  kitchenMarkOrderReady,
  subscribeKitchenKdsOrders,
  type StaffOrderRow
} from "../../services/orders";

function sortKdsOrders(rows: StaffOrderRow[]): StaffOrderRow[] {
  return [...rows].sort((a, b) => {
    const pa = a.canonicalStatus === "pending" || String(a.status) === "PLACED" ? 0 : 1;
    const pb = b.canonicalStatus === "pending" || String(b.status) === "PLACED" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
}

export function KitchenView() {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: KitchenTicketAction } | null>(null);

  const prevIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const sorted = useMemo(() => sortKdsOrders(orders), [orders]);

  useEffect(() => {
    const unsub = subscribeKitchenKdsOrders(
      (next) => {
        const nextIds = new Set(next.map((o) => o.id));

        if (bootstrappedRef.current) {
          for (const o of next) {
            if (!prevIdsRef.current.has(o.id)) {
              void printKitchenTicketForStaffOrder({
                items: o.items,
                totalAmount: o.totalAmount,
                tableNumber: o.tableNumber,
                tokenNumber: o.tokenNumber
              }).catch(() => {
                /* printing is best-effort */
              });
            }
          }
        } else {
          bootstrappedRef.current = true;
        }

        prevIdsRef.current = nextIds;
        setOrders(next);
        setError(null);
      },
      (err) => setError(err.message)
    );
    return unsub;
  }, []);

  const runAccept = useCallback(async (order: StaffOrderRow) => {
    setBusy({ id: order.id, action: "accept" });
    try {
      await kitchenAcceptOrder(order);
    } catch (e) {
      Alert.alert("Accept failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }, []);

  const runReady = useCallback(async (order: StaffOrderRow) => {
    setBusy({ id: order.id, action: "ready" });
    try {
      await kitchenMarkOrderReady(order);
    } catch (e) {
      Alert.alert("Mark ready failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Kitchen</Text>
      <Text style={styles.sub}>Live queue — pending &amp; preparing. New tickets print automatically.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={sorted}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <KitchenTicketCard
            order={item}
            busy={busy?.id === item.id ? busy.action : null}
            onAccept={() => runAccept(item)}
            onMarkReady={() => runReady(item)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tickets in queue</Text>}
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
    marginBottom: 12,
    lineHeight: 20
  },
  error: { color: "#fca5a5", paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 32 },
  empty: { textAlign: "center", marginTop: 48, color: "#64748b", fontSize: 16 }
});
