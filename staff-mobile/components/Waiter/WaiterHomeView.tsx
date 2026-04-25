import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { OrderCard, type OrderCardAction } from "../OrderCard";
import { TableCard } from "../TableCard";
import { subscribeAllOrders, type StaffOrderRow } from "../../services/orders";
import { patchWaiterTable, subscribeAllTables, type FloorTable } from "../../services/tables";
import { useAuthStore } from "../../store/useAuthStore";

type WaiterTab = "tables" | "orders";

function isWaiterQueue(order: StaffOrderRow): boolean {
  const c = order.canonicalStatus;
  return c === "pending" || c === "preparing" || c === "ready";
}

function isPendingPayment(order: StaffOrderRow): boolean {
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  return ps === "pending";
}

export function WaiterHomeView() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const [tab, setTab] = useState<WaiterTab>("tables");

  const [tables, setTables] = useState<FloorTable[]>([]);
  const [tableErr, setTableErr] = useState<string | null>(null);

  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<OrderCardAction | null>(null);

  useEffect(() => {
    const unsub = subscribeAllTables(
      (rows) => {
        setTables(rows);
        setTableErr(null);
      },
      (err) => setTableErr(err.message)
    );
    return unsub;
  }, []);

  useEffect(() => {
    setOrdersLoading(true);
    const unsub = subscribeAllOrders(
      (next) => {
        setOrders(next);
        setOrdersLoading(false);
        setRefreshing(false);
        setOrdersErr(null);
      },
      (err) => {
        setOrdersErr(err.message);
        setOrdersLoading(false);
        setRefreshing(false);
      }
    );
    return unsub;
  }, []);

  const openOrderForTable = useCallback(
    (table: FloorTable) => {
      const num = Number.isFinite(table.number) ? String(table.number) : "";
      router.push({
        pathname: "/waiter/order/[tableId]",
        params: { tableId: table.id, tableNumber: num }
      });
    },
    [router]
  );

  const canManage = role === "waiter" || role === "admin" || role === "manager";

  const filtered = useMemo(() => orders.filter(isWaiterQueue), [orders]);
  const pendingPayments = useMemo(() => orders.filter(isPendingPayment), [orders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  if (!role) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading role…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab("tables")}
          style={[styles.tabBtn, tab === "tables" && styles.tabBtnOn]}
        >
          <Text style={[styles.tabText, tab === "tables" && styles.tabTextOn]}>Tables</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("orders")}
          style={[styles.tabBtn, tab === "orders" && styles.tabBtnOn]}
        >
          <Text style={[styles.tabText, tab === "orders" && styles.tabTextOn]}>Orders</Text>
        </Pressable>
      </View>

      {tab === "tables" ? (
        <View style={styles.panel}>
          <Text style={styles.heading}>Tables</Text>
          <Text style={styles.sub}>Floor status — real-time from Firestore.</Text>
          {tableErr ? <Text style={styles.error}>{tableErr}</Text> : null}
          {!canManage ? (
            <Text style={styles.note}>Your role can view tables but not change floor status.</Text>
          ) : null}
          <FlatList
            data={tables}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TableCard
                table={item}
                disabled={!canManage}
                onOpenOrder={() => openOrderForTable(item)}
                onToggle={
                  canManage
                    ? async (_table, next) => {
                        try {
                          await patchWaiterTable(_table.id, {
                            status: next,
                            currentOrderId: next === "FREE" ? null : _table.currentOrderId ?? null
                          });
                        } catch (e) {
                          Alert.alert("Could not update table", e instanceof Error ? e.message : "Unknown error");
                        }
                      }
                    : undefined
                }
              />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No tables found.</Text>}
          />
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.heading}>Orders</Text>
          <Text style={styles.sub}>Kitchen queue and unpaid cheques.</Text>
          {ordersErr ? <Text style={styles.error}>{ordersErr}</Text> : null}
          {ordersLoading && filtered.length === 0 && pendingPayments.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending payments</Text>
            <Text style={styles.sectionSub}>paymentStatus = pending</Text>
            <FlatList
              data={pendingPayments}
              keyExtractor={(item) => item.id}
              nestedScrollEnabled
              style={styles.paymentsList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => (
                <OrderCard
                  order={item}
                  role={role}
                  busyAction={busy}
                  onBusy={setBusy}
                  restaurantFlow
                  onUpdated={() => undefined}
                />
              )}
              ListEmptyComponent={
                !ordersLoading ? (
                  <Text style={styles.emptyInline}>None</Text>
                ) : (
                  <Text style={styles.emptyInline}> </Text>
                )
              }
            />
          </View>

          <View style={styles.sectionGrow}>
            <Text style={styles.sectionTitle}>Active orders</Text>
            <Text style={styles.sectionSub}>Pending, preparing, ready</Text>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <OrderCard
                  order={item}
                  role={role}
                  busyAction={busy}
                  onBusy={setBusy}
                  restaurantFlow
                  onUpdated={() => undefined}
                />
              )}
              ListEmptyComponent={
                !ordersLoading ? (
                  <Text style={styles.empty}>No orders in queue</Text>
                ) : (
                  <Text style={styles.empty}> </Text>
                )
              }
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center"
  },
  tabBtnOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tabText: { fontSize: 15, fontWeight: "800", color: "#475569" },
  tabTextOn: { color: "#fff" },
  panel: { flex: 1 },
  heading: { fontSize: 24, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, paddingTop: 8 },
  sub: { fontSize: 14, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 8 },
  note: { fontSize: 13, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 24 },
  empty: { textAlign: "center", marginTop: 24, color: "#64748b", fontSize: 15 },
  emptyInline: { textAlign: "center", color: "#94a3b8", paddingVertical: 12, fontSize: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#64748b" },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  section: { maxHeight: 260, paddingBottom: 8 },
  sectionGrow: { flex: 1, minHeight: 120 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, marginTop: 4 },
  sectionSub: { fontSize: 12, color: "#94a3b8", paddingHorizontal: 16, marginBottom: 6 },
  paymentsList: { flexGrow: 0 }
});
