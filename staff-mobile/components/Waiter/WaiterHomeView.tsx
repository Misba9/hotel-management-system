import { isWaiterPosDineInOrder } from "@shared/utils/waiter-pos-order";
import {
  isActivePipelineStatus,
  normalizeOrderStatus,
  normalizePaymentStatus
} from "@shared/utils/canonical-order-fields";
import { formatItemExtras, formatOrderLineWithExtras } from "@shared/lib/format-item-extras";
import { formatKitchenStatusLabel, formatPaymentStatusLabel } from "@shared/utils/order-display";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  UIManager,
  View
} from "react-native";

import { TablePosGridCard } from "../TablePosGridCard";
import {
  markCashierOrderPaid,
  subscribeWaiterOrders,
  type StaffOrderRow
} from "../../services/orders";
import { patchWaiterTable, subscribeAllTables, type FloorTable } from "../../services/tables";
import { staffAuth } from "../../src/lib/firebase";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";
import { getGridCellWidth, getGridColumnCount } from "../../src/lib/responsive";
import { useAuthStore } from "../../store/useAuthStore";

type WaiterTab = "tables" | "orders" | "history";
type OrdersPaymentFilter = "all" | "unpaid" | "paid";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function orderMatchesTable(o: StaffOrderRow, t: FloorTable): boolean {
  if (o.tableId && o.tableId === t.id) return true;
  if (!o.tableId && typeof o.tableNumber === "number" && Number.isFinite(o.tableNumber) && o.tableNumber === t.number)
    return true;
  return false;
}

function isOrderUnpaid(order: StaffOrderRow): boolean {
  return normalizePaymentStatus(String(order.paymentStatus ?? "")) !== "paid";
}

function isOrderPaid(order: StaffOrderRow): boolean {
  return normalizePaymentStatus(String(order.paymentStatus ?? "")) === "paid";
}

/** Show Mark Paid when payment is still pending (any kitchen stage). */
function canMarkPaid(order: StaffOrderRow): boolean {
  return normalizePaymentStatus(String(order.paymentStatus ?? "")) === "pending";
}

function formatOrderAge(createdAt: StaffOrderRow["createdAt"]): string {
  const ms = createdAt?.toMillis?.();
  if (!ms) return "Just now";
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hr = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return rem > 0 ? `${hr}h ${rem}m ago` : `${hr}h ago`;
}

function isUrgentOrder(createdAt: StaffOrderRow["createdAt"]): boolean {
  const ms = createdAt?.toMillis?.();
  if (!ms) return false;
  return Date.now() - ms > 10 * 60 * 1000;
}

function fallbackTokenNumber(order: StaffOrderRow): string {
  if (typeof order.tokenNumber === "number" && Number.isFinite(order.tokenNumber)) {
    return String(order.tokenNumber);
  }
  const raw = order.id?.slice(-4) ?? "0000";
  const numeric = Number.parseInt(raw, 16);
  if (Number.isFinite(numeric)) return String((numeric % 9000) + 1000);
  return "—";
}

function fallbackTableLabel(order: StaffOrderRow): string {
  if (order.tableName?.trim()) return order.tableName.trim();
  if (order.tableNumber != null && Number.isFinite(Number(order.tableNumber))) {
    return `Table ${order.tableNumber}`;
  }
  if (order.tableId?.trim()) return `Table ${order.tableId.trim().slice(-4).toUpperCase()}`;
  return "Table —";
}

export function WaiterHomeView() {
  const router = useRouter();
  const { width: winWidth, padding } = useResponsiveLayout();
  const role = useAuthStore((s) => s.role);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<WaiterTab>("tables");
  const switchTab = useCallback((nextTab: WaiterTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(nextTab);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tables, setTables] = useState<FloorTable[]>([]);
  const [tableErr, setTableErr] = useState<string | null>(null);

  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [ordersPaymentFilter, setOrdersPaymentFilter] = useState<OrdersPaymentFilter>("unpaid");

  const [historyErr, setHistoryErr] = useState<string | null>(null);

  const ordersFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOrdersRef = useRef<StaffOrderRow[]>([]);
  const healAttemptRef = useRef(new Set<string>());

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
    let firstSnapshot = true;
    setOrdersLoading(true);

    const flushOrders = () => {
      setOrders(pendingOrdersRef.current);
      setOrdersLoading(false);
      setRefreshing(false);
      setOrdersErr(null);
      setHistoryErr(null);
    };

    const unsub = subscribeWaiterOrders(
      (next) => {
        pendingOrdersRef.current = next;
        if (firstSnapshot) {
          firstSnapshot = false;
          flushOrders();
          return;
        }
        if (ordersFlushTimerRef.current) return;
        ordersFlushTimerRef.current = setTimeout(() => {
          ordersFlushTimerRef.current = null;
          flushOrders();
        }, 300);
      },
      (err) => {
        setOrdersErr(err.message);
        setHistoryErr(err.message);
        setOrdersLoading(false);
        setRefreshing(false);
      }
    );

    return () => {
      if (ordersFlushTimerRef.current) {
        clearTimeout(ordersFlushTimerRef.current);
        ordersFlushTimerRef.current = null;
      }
      unsub();
    };
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

  const allOrdersList = useMemo(() => {
    const rows = orders.filter(isWaiterPosDineInOrder);
    rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return rows;
  }, [orders]);
  const filteredOrders = useMemo(() => {
    if (ordersPaymentFilter === "unpaid") return allOrdersList.filter(isOrderUnpaid);
    if (ordersPaymentFilter === "paid") return allOrdersList.filter(isOrderPaid);
    return allOrdersList;
  }, [allOrdersList, ordersPaymentFilter]);
  const historyOrders = useMemo(() => {
    const rows = orders.filter((o) => {
      if (!isWaiterPosDineInOrder(o)) return false;
      const status = normalizeOrderStatus(String(o.status ?? ""));
      const paymentStatus = String(o.paymentStatus ?? "").toLowerCase();
      return status === "completed" && paymentStatus === "paid";
    });
    rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return rows;
  }, [orders]);

  const activePosCountByTableId = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tables) {
      let c = 0;
      for (const o of orders) {
        if (!isWaiterPosDineInOrder(o)) continue;
        if (!isActivePipelineStatus(o.canonicalStatus ?? o.status)) continue;
        if (orderMatchesTable(o, t)) c++;
      }
      m.set(t.id, c);
    }
    return m;
  }, [tables, orders]);

  /** Heal stale Firestore rows once per table — avoid write storms that freeze Android. */
  useEffect(() => {
    if (tables.length === 0 || ordersLoading) return;
    for (const t of tables) {
      const active = activePosCountByTableId.get(t.id) ?? 0;
      if (active > 0) {
        healAttemptRef.current.delete(t.id);
        continue;
      }
      if (t.status !== "occupied") continue;
      if (healAttemptRef.current.has(t.id)) continue;
      healAttemptRef.current.add(t.id);
      void patchWaiterTable(t.id, { status: "FREE", currentOrderId: null }).catch(() => {
        healAttemptRef.current.delete(t.id);
      });
    }
  }, [tables, ordersLoading, activePosCountByTableId]);

  const gridColumns = getGridColumnCount(winWidth, { phone: 2, tablet: 3, largeTablet: 4 });
  const listColumns = getGridColumnCount(winWidth, { phone: 1, tablet: 2, largeTablet: 3 });
  const gridGap = 10;
  const gridPad = padding;
  const cellWidth = getGridCellWidth(winWidth, gridColumns, gridPad, gridGap);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const waiterName = useMemo(() => {
    const profileName = profile?.name?.trim();
    if (profileName) return profileName;
    const authName = user?.displayName?.trim();
    if (authName) return authName;
    const emailName = user?.email?.split("@")[0]?.trim();
    if (emailName) return emailName;
    return "Waiter";
  }, [profile?.name, user?.displayName, user?.email]);

  const avatarLetter = useMemo(() => waiterName.charAt(0).toUpperCase() || "W", [waiterName]);

  const openProfile = useCallback(() => {
    setMenuOpen(false);
    router.push("/profile");
  }, [router]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setMenuOpen(false);
    setLoggingOut(true);
    try {
      await signOut(staffAuth);
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  if (!role) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading role…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingHorizontal: padding }]}>
        <Text style={styles.topBarTitle}>Waiter</Text>
        <Pressable style={styles.profileTrigger} onPress={() => setMenuOpen((prev) => !prev)} hitSlop={8}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </View>
          <Text style={styles.waiterName} numberOfLines={1}>
            {waiterName}
          </Text>
        </Pressable>
      </View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={[styles.dropdownBackdrop, { paddingHorizontal: padding }]}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                <Pressable style={styles.dropdownItem} onPress={openProfile}>
                  <Text style={styles.dropdownText}>Profile</Text>
                </Pressable>
                <Pressable style={styles.dropdownItem} onPress={() => void handleLogout()} disabled={loggingOut}>
                  <Text style={[styles.dropdownText, styles.logoutText]}>
                    {loggingOut ? "Logging out..." : "Logout"}
                  </Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={[styles.tabRow, { marginHorizontal: padding }]}>
        <Pressable
          onPress={() => switchTab("tables")}
          style={[styles.tabBtn, tab === "tables" && styles.tabBtnOn]}
        >
          <Text style={[styles.tabText, tab === "tables" && styles.tabTextOn]}>Tables</Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab("orders")}
          style={[styles.tabBtn, tab === "orders" && styles.tabBtnOn]}
        >
          <Text style={[styles.tabText, tab === "orders" && styles.tabTextOn]}>Orders</Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab("history")}
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
            contentContainerStyle={[styles.gridContent, { paddingHorizontal: gridPad }]}
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
          <Text style={styles.sub}>Completed and paid orders.</Text>
          {historyErr ? <Text style={styles.error}>{historyErr}</Text> : null}
          {ordersLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : (
            <FlatList
              data={historyOrders}
              key={`history-${listColumns}`}
              numColumns={listColumns}
              keyExtractor={(o) => o.id}
              columnWrapperStyle={listColumns > 1 ? styles.ordersGridRow : undefined}
              contentContainerStyle={[styles.historyList, { paddingHorizontal: padding }]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => {
                const when = item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleString()
                  : "—";
                const tablePart =
                  item.tableName?.trim() ||
                  (item.tableNumber != null ? `Table ${item.tableNumber}` : "—");
                const lines = (item.items ?? [])
                  .slice(0, 4)
                  .map((it) => formatOrderLineWithExtras(it))
                  .join("\n");
                return (
                  <View style={listColumns > 1 ? styles.ordersGridCell : styles.ordersGridCellSingle}>
                    <View style={styles.cleanCard}>
                      <View style={styles.cleanTopRow}>
                        <Text style={styles.cleanTitle}>{tablePart}</Text>
                        <View style={styles.historyBadgeRow}>
                          <View style={styles.doneBadge}>
                            <Text style={styles.doneBadgeText}>Done</Text>
                          </View>
                          <View style={styles.paidBadge}>
                            <Text style={styles.paidBadgeText}>Paid</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.cleanItems}>{lines || "No items"}</Text>
                      <View style={styles.historyMetaRow}>
                        <Text style={styles.cleanTotalRight}>₹{Number(item.totalAmount ?? 0).toFixed(0)}</Text>
                        <Text style={styles.historyTime}>{when}</Text>
                      </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No paid completed orders yet.</Text>}
            />
          )}
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.heading}>Orders</Text>
          <Text style={styles.sub}>Kitchen status and payments in one list.</Text>
          <View style={styles.filterRow}>
            {(
              [
                { id: "all", label: "All" },
                { id: "unpaid", label: "Unpaid" },
                { id: "paid", label: "Paid" }
              ] as const
            ).map((f) => {
              const on = ordersPaymentFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setOrdersPaymentFilter(f.id)}
                  style={[styles.filterChip, on && styles.filterChipOn]}
                >
                  <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {ordersErr ? <Text style={styles.error}>{ordersErr}</Text> : null}
          {ordersLoading && filteredOrders.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : null}
          <FlatList
            data={filteredOrders}
            key={`orders-${listColumns}`}
            numColumns={listColumns}
            keyExtractor={(order) => order.id}
            style={styles.ordersScroll}
            columnWrapperStyle={listColumns > 1 ? styles.ordersGridRow : undefined}
            contentContainerStyle={[styles.ordersScrollContent, { paddingHorizontal: padding }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              !ordersLoading ? (
                <Text style={styles.emptyInline}>
                  {ordersPaymentFilter === "paid"
                    ? "No paid orders yet."
                    : ordersPaymentFilter === "unpaid"
                      ? "No unpaid orders."
                      : "No orders yet."}
                </Text>
              ) : null
            }
            renderItem={({ item: order }) => {
              const tableLabel = fallbackTableLabel(order);
              const orderItems = (order.items ?? []).slice(0, 6);
              const tokenLabel = fallbackTokenNumber(order);
              const age = formatOrderAge(order.createdAt);
              const urgent = isUrgentOrder(order.createdAt);
              const kitchenLabel = formatKitchenStatusLabel(order.canonicalStatus ?? order.status);
              const paymentLabel = formatPaymentStatusLabel(order.paymentStatus);
              const unpaid = canMarkPaid(order);
              const paid = isOrderPaid(order);
              const isPaying = payingOrderId === order.id;
              return (
                <View style={listColumns > 1 ? styles.ordersGridCell : styles.ordersGridCellSingle}>
                  <View style={[styles.cleanCard, urgent && styles.urgentCard]}>
                    <View style={styles.cleanTopRow}>
                      <Text style={styles.cleanTitle}>{tableLabel}</Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.preparingBadge}>
                          <Text style={styles.preparingBadgeText}>{kitchenLabel}</Text>
                        </View>
                        <View style={paid ? styles.paidBadge : styles.pendingBadge}>
                          <Text style={paid ? styles.paidBadgeText : styles.pendingBadgeText}>
                            {paymentLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.cleanMeta}>Token #{tokenLabel}</Text>
                      <Text style={[styles.cleanMeta, urgent && styles.urgentMeta]}>{age}</Text>
                    </View>
                    {orderItems.length === 0 ? (
                      <Text style={styles.cleanItems}>No items</Text>
                    ) : (
                      <View style={styles.itemList}>
                        {orderItems.map((it, idx) => {
                          const extras = formatItemExtras(it);
                          return (
                            <View key={`${order.id}-${it.id || idx}-${it.name}`} style={styles.itemRow}>
                              <Text style={styles.itemName}>
                                {it.qty}× {it.name}
                              </Text>
                              {extras ? <Text style={styles.itemMods}>+ {extras}</Text> : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    <View style={styles.paymentRow}>
                      <Text style={styles.cleanTotalRight}>₹{Number(order.totalAmount ?? 0).toFixed(0)}</Text>
                      {unpaid ? (
                        <Pressable
                          onPress={async () => {
                            if (isPaying) return;
                            setPayingOrderId(order.id);
                            try {
                              await markCashierOrderPaid(order.id);
                            } catch (e) {
                              Alert.alert(
                                "Payment update failed",
                                e instanceof Error ? e.message : "Could not mark payment as paid."
                              );
                            } finally {
                              setPayingOrderId(null);
                            }
                          }}
                          disabled={isPaying}
                          style={[styles.markPaidBtn, isPaying && styles.markPaidBtnDisabled]}
                        >
                          <Text style={styles.markPaidText}>{isPaying ? "Marking..." : "Mark Paid"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", height: "100%", alignSelf: "stretch", backgroundColor: "#f8fafc" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    width: "100%"
  },
  topBarTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  profileTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    maxWidth: "70%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a"
  },
  avatarLetter: { color: "#fff", fontSize: 13, fontWeight: "800" },
  waiterName: { fontSize: 14, fontWeight: "700", color: "#1e293b", flexShrink: 1 },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.08)",
    alignItems: "flex-end",
    paddingTop: 66
  },
  dropdownMenu: {
    minWidth: 170,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#020617",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  dropdownText: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  logoutText: { color: "#b91c1c" },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minHeight: 48
  },
  tabBtn: {
    flex: 1,
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  tabBtnOn: {
    backgroundColor: "#0f172a",
    shadowColor: "#020617",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  tabText: { fontSize: 14, fontWeight: "700", color: "#64748b" },
  tabTextOn: { color: "#ffffff" },
  panel: { flex: 1, width: "100%" },
  heading: { fontSize: 24, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, paddingTop: 8 },
  sub: { fontSize: 14, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 8 },
  note: { fontSize: 13, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 24 },
  historyList: { paddingBottom: 24, width: "100%" },
  ordersScroll: { flex: 1 },
  ordersScrollContent: { paddingBottom: 24, gap: 4, width: "100%" },
  ordersGridRow: { gap: 12 },
  ordersGridCell: { flex: 1, minWidth: 0, marginBottom: 4 },
  ordersGridCellSingle: { width: "100%", marginBottom: 4 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  filterChipOn: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a"
  },
  filterChipText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  filterChipTextOn: { color: "#ffffff" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  gridContent: { paddingHorizontal: 16, paddingBottom: 32 },
  gridRow: { gap: 10, marginBottom: 10 },
  empty: { textAlign: "center", marginTop: 24, color: "#64748b", fontSize: 15 },
  emptyInline: { textAlign: "center", color: "#94a3b8", paddingVertical: 12, fontSize: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#64748b" },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  section: { maxHeight: 260, paddingBottom: 8 },
  sectionGrow: { flex: 1, minHeight: 120 },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, marginTop: 4 },
  sectionSub: { fontSize: 12, color: "#94a3b8", paddingHorizontal: 16, marginBottom: 6 },
  paymentsList: { flexGrow: 0 },
  cleanCard: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cleanTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metaRow: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cleanTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", flex: 1 },
  cleanMeta: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#64748b" },
  urgentMeta: { color: "#b91c1c" },
  cleanItems: { marginTop: 8, fontSize: 14, color: "#334155", lineHeight: 20 },
  itemList: { marginTop: 8, gap: 6 },
  itemRow: { gap: 2 },
  itemName: { fontSize: 14, fontWeight: "600", color: "#1e293b", lineHeight: 20 },
  itemMods: { fontSize: 12, fontWeight: "600", color: "#b45309", lineHeight: 16 },
  cleanTotal: { marginTop: 10, fontSize: 18, fontWeight: "900", color: "#0f172a" },
  cleanTotalRight: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "right",
    marginLeft: "auto"
  },
  preparingBadge: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  preparingBadgeText: { fontSize: 12, fontWeight: "800", color: "#9a3412" },
  pendingBadge: {
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  pendingBadgeText: { fontSize: 12, fontWeight: "800", color: "#c2410c" },
  doneBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999
  },
  doneBadgeText: { fontSize: 12, fontWeight: "800", color: "#1d4ed8" },
  paidBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999
  },
  paidBadgeText: { fontSize: 12, fontWeight: "800", color: "#15803d" },
  historyBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paymentRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  markPaidBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  markPaidBtnDisabled: { opacity: 0.65 },
  markPaidText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  urgentCard: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff7f7"
  },
  historyMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  historyTime: { fontSize: 12, color: "#64748b", fontWeight: "600", flexShrink: 1, textAlign: "right" },
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
