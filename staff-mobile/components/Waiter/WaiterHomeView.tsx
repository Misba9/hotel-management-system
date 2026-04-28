import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { OrderCard, type OrderCardAction } from "../OrderCard";
import { TablePosGridCard } from "../TablePosGridCard";
import { WaiterActiveOrderCard } from "../WaiterActiveOrderCard";
import { subscribeAllOrders, subscribeRecentOrders, type StaffOrderRow } from "../../services/orders";
import { subscribeAllTables, type FloorTable } from "../../services/tables";
import { useAuthStore } from "../../store/useAuthStore";

type WaiterTab = "tables" | "orders" | "history";

function isWaiterQueue(order: StaffOrderRow): boolean {
  if (isWaiterPosDineInOrder(order)) {
    return order.canonicalStatus === "pending" || order.canonicalStatus === "preparing";
  }
  const c = order.canonicalStatus;
  return c === "pending" || c === "preparing" || c === "ready";
}

function orderMatchesTable(o: StaffOrderRow, t: FloorTable): boolean {
  if (o.tableId && o.tableId === t.id) return true;
  if (!o.tableId && typeof o.tableNumber === "number" && Number.isFinite(o.tableNumber) && o.tableNumber === t.number)
    return true;
  return false;
}

function isPendingPayment(order: StaffOrderRow): boolean {
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  return ps === "pending";
}

export function WaiterHomeView() {
  const router = useRouter();
  const { width: winWidth } = useWindowDimensions();
  const role = useAuthStore((s) => s.role);
  const [tab, setTab] = useState<WaiterTab>("tables");

  const [tables, setTables] = useState<FloorTable[]>([]);
  const [tableErr, setTableErr] = useState<string | null>(null);

  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<OrderCardAction | null>(null);

  const [historyOrders, setHistoryOrders] = useState<StaffOrderRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

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
      const tableName = table.displayName?.trim() || (num ? `Table ${num}` : table.id);
      router.push({
        pathname: "/waiter/order/[tableId]",
        params: { tableId: table.id, tableNumber: num, tableName }
      });
    },
    [router]
  );

  const filtered = useMemo(() => orders.filter(isWaiterQueue), [orders]);
  const pendingPayments = useMemo(() => orders.filter(isPendingPayment), [orders]);

  const activePosCountByTableId = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tables) {
      let c = 0;
      for (const o of orders) {
        if (!isWaiterPosDineInOrder(o)) continue;
        const st = String(o.status ?? "").toLowerCase();
        if (st !== "pending" && st !== "preparing") continue;
        if (orderMatchesTable(o, t)) c++;
      }
      m.set(t.id, c);
    }
    return m;
  }, [tables, orders]);

  const gridColumns = winWidth >= 960 ? 4 : winWidth >= 700 ? 3 : 2;
  const gridGap = 10;
  const gridPad = 16;
  const cellWidth = (winWidth - gridPad * 2 - gridGap * (gridColumns - 1)) / gridColumns;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    setHistoryLoading(true);
    const unsub = subscribeRecentOrders(
      (rows) => {
        const dineIn = rows.filter(
          (o) =>
            isWaiterPosDineInOrder(o) &&
            ["done", "served", "ready", "completed"].includes(String(o.status ?? "").toLowerCase())
        );
        dineIn.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setHistoryOrders(dineIn.slice(0, 80));
        setHistoryLoading(false);
        setHistoryErr(null);
      },
      (err) => {
        setHistoryErr(err.message);
        setHistoryLoading(false);
      }
    );
    return unsub;
  }, [tab]);

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
        <Pressable
          onPress={() => setTab("history")}
          style={[styles.tabBtn, tab === "history" && styles.tabBtnOn]}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextOn]}>History</Text>
        </Pressable>
      </View>

      {tab === "tables" ? (
        <View style={styles.panel}>
          <Text style={styles.heading}>Floor</Text>
          <Text style={styles.sub}>Tap a table to take an order. Multiple open tickets per table are supported.</Text>
          {tableErr ? <Text style={styles.error}>{tableErr}</Text> : null}
          <FlatList
            key={gridColumns}
            data={tables}
            numColumns={gridColumns}
            keyExtractor={(t) => t.id}
            columnWrapperStyle={gridColumns > 1 ? styles.gridRow : undefined}
            contentContainerStyle={styles.gridContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={{ width: cellWidth }}>
                <TablePosGridCard
                  table={item}
                  width={cellWidth}
                  activeOrderCount={activePosCountByTableId.get(item.id) ?? 0}
                  onTakeOrder={() => openOrderForTable(item)}
                />
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No tables found. Add tables in Admin → Tables (Firestore `tables`).
              </Text>
            }
          />
        </View>
      ) : tab === "history" ? (
        <View style={styles.panel}>
          <Text style={styles.heading}>Order history</Text>
          <Text style={styles.sub}>Completed dine-in tickets (kitchen done or served).</Text>
          {historyErr ? <Text style={styles.error}>{historyErr}</Text> : null}
          {historyLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : (
            <FlatList
              data={historyOrders}
              keyExtractor={(o) => o.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                const when = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleString()
                  : "—";
                const tablePart =
                  item.tableName?.trim() ||
                  (item.tableNumber != null ? `Table ${item.tableNumber}` : "—");
                return (
                  <View style={styles.historyCard}>
                    <Text style={styles.historyTitle}>
                      #{item.tokenNumber ?? "—"} · {tablePart}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {when} · {String(item.status ?? "")} · ₹{Number(item.totalAmount ?? 0).toFixed(0)}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No completed tickets yet.</Text>}
            />
          )}
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
          <Text style={styles.sectionSub}>POS: pending & preparing · Other: includes ready</Text>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.list}
              renderItem={({ item }) =>
                isWaiterPosDineInOrder(item) ? (
                  <WaiterActiveOrderCard order={item} />
                ) : (
                  <OrderCard
                    order={item}
                    role={role}
                    busyAction={busy}
                    onBusy={setBusy}
                    restaurantFlow
                    onUpdated={() => undefined}
                  />
                )
              }
              ListEmptyComponent={
                !ordersLoading ? (
                  <Text style={styles.empty}>No active orders</Text>
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
    gap: 6,
    paddingHorizontal: 12,
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
  gridContent: { paddingHorizontal: 16, paddingBottom: 32 },
  gridRow: { gap: 10, marginBottom: 10 },
  empty: { textAlign: "center", marginTop: 24, color: "#64748b", fontSize: 15 },
  emptyInline: { textAlign: "center", color: "#94a3b8", paddingVertical: 12, fontSize: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#64748b" },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  section: { maxHeight: 260, paddingBottom: 8 },
  sectionGrow: { flex: 1, minHeight: 120 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, marginTop: 4 },
  sectionSub: { fontSize: 12, color: "#94a3b8", paddingHorizontal: 16, marginBottom: 6 },
  paymentsList: { flexGrow: 0 },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  historyTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  historyMeta: { marginTop: 4, fontSize: 13, color: "#64748b" }
});
