import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { useMobileTheme } from "../../../../shared/theme/react-native/MobileThemeProvider";
import { useAuthStore } from "../../../store/useAuthStore";
import { staffDb } from "../../lib/firebase";
import { subscribeStaffDirectory, type StaffDirectoryRow } from "../../../services/manager";
import { useManagerModule } from "./manager-module-context";

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return new Date();
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "ready" || s === "completed" || s === "served") return "success";
  if (s === "preparing" || s === "accepted") return "warning";
  if (s === "pending" || s === "new") return "info";
  return "default";
}

type ManagerOrderFilter =
  | "all"
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "dine_in"
  | "online"
  | "parcel";

const ORDER_FILTERS: Array<{ key: ManagerOrderFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "dine_in", label: "Dine In" },
  { key: "online", label: "Online" },
  { key: "parcel", label: "Parcel" }
];

function orderStatusLower(order: Record<string, unknown>): string {
  return String(order.canonicalStatus ?? order.status ?? "").toLowerCase();
}

function orderTypeLower(order: Record<string, unknown>): string {
  return String(order.orderType ?? order.type ?? "").toLowerCase();
}

function orderMatchesFilter(order: Record<string, unknown>, filter: ManagerOrderFilter): boolean {
  if (filter === "all") return true;
  const status = orderStatusLower(order);
  const type = orderTypeLower(order);
  const source = String(order.source ?? "").toLowerCase();
  if (filter === "pending") return ["pending", "new", "accepted"].includes(status);
  if (filter === "preparing") return status === "preparing";
  if (filter === "ready") return status === "ready";
  if (filter === "completed") return ["completed", "delivered", "done", "served"].includes(status);
  if (filter === "cancelled") return status === "cancelled";
  if (filter === "dine_in") return type === "dine_in" || type === "table";
  if (filter === "online") return type === "online" || ["online", "website", "swiggy", "zomato"].includes(source);
  if (filter === "parcel") return type === "parcel" || source === "parcel";
  return true;
}

function ManagerScaffold({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { colors } = useMobileTheme();
  const { isOnline, fromCache, lastSyncAt, refresh } = useManagerModule();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border
          }
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
          <Pressable
            onPress={refresh}
            style={[
              styles.refreshPill,
              { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
            ]}
          >
            <MaterialCommunityIcons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
          </Pressable>
        </View>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isOnline ? colors.successMuted : colors.warningMuted,
                borderColor: isOnline ? colors.success : colors.warning
              }
            ]}
          >
            <Text style={[styles.badgeText, { color: isOnline ? colors.success : colors.warning }]}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
          {fromCache ? (
            <View style={[styles.badge, { backgroundColor: colors.infoMuted, borderColor: colors.info }]}>
              <Text style={[styles.badgeText, { color: colors.info }]}>Cached snapshot</Text>
            </View>
          ) : null}
          {lastSyncAt ? (
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>
              Synced {new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

export function ManagerDashboardScreen() {
  const { colors } = useMobileTheme();
  const router = useRouter();
  const { orders, kitchenOrders, tables, loading, error } = useManagerModule();

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayOrders = orders.filter((order) => toDate(order.createdAt).getTime() >= todayStart);
    const todaySales = todayOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
    const pendingBills = orders.filter((o) => {
      const status = String(o.paymentStatus ?? "").toLowerCase();
      return status === "pending" || status === "requested";
    }).length;
    const occupied = tables.filter((t) => t.uiStatus === "occupied").length;
    return {
      todaySales,
      orders: todayOrders.length,
      kitchenQueue: kitchenOrders.length,
      occupiedTables: occupied,
      pendingBills
    };
  }, [orders, kitchenOrders, tables]);

  return (
    <ManagerScaffold
      title="Manager Dashboard"
      subtitle="Material 3 mobile cockpit for realtime operations"
    >
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        ) : null}
        <View style={styles.metricGrid}>
          {[
            ["Today's Sales", `₹${Math.round(stats.todaySales)}`, "cash-multiple"],
            ["Orders", stats.orders.toString(), "clipboard-list-outline"],
            ["Kitchen Queue", stats.kitchenQueue.toString(), "chef-hat"],
            ["Occupied Tables", stats.occupiedTables.toString(), "table-furniture"],
            ["Pending Bills", stats.pendingBills.toString(), "receipt"]
          ].map(([label, value, icon]) => (
            <View
              key={label}
              style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {[
              ["View Orders", "clipboard-list-outline", "/manager/orders"],
              ["Kitchen", "chef-hat", "/manager/kitchen"],
              ["Tables", "table-furniture", "/manager/tables"],
              ["Staff", "account-group-outline", "/manager/staff"],
              ["Notifications", "bell-outline", "/manager/notifications"]
            ].map(([label, icon, href]) => (
              <Pressable
                key={label}
                onPress={() => router.push(href as never)}
                style={[styles.quickAction, { backgroundColor: colors.hover, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {loading ? <Text style={[styles.loading, { color: colors.textSecondary }]}>Loading dashboard...</Text> : null}
      </ScrollView>
    </ManagerScaffold>
  );
}

export function ManagerOrdersScreen() {
  const { colors } = useMobileTheme();
  const { orders, loading } = useManagerModule();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ManagerOrderFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [waiters, setWaiters] = useState<StaffDirectoryRow[]>([]);
  const [waiterError, setWaiterError] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeStaffDirectory(
      (rows) => {
        setWaiters(
          rows.filter(
            (row) =>
              row.isActive &&
              ["waiter", "service", "floor"].some((s) => row.roleLabel.toLowerCase().includes(s))
          )
        );
        setWaiterError(null);
      },
      (err) => setWaiterError(err.message)
    );
    return () => unsub();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((raw) => {
      const order = raw as Record<string, unknown>;
      if (!orderMatchesFilter(order, filter)) return false;
      if (!q) return true;
      const haystack = [
        String(order.id ?? ""),
        String(order.tokenNumber ?? ""),
        String(order.customerName ?? ""),
        String((order.customer as { name?: string } | undefined)?.name ?? ""),
        String(order.customerPhone ?? ""),
        String(order.tableName ?? ""),
        String(order.source ?? ""),
        String(order.orderType ?? ""),
        String(order.canonicalStatus ?? order.status ?? "")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search, filter]);

  const selectedOrder = useMemo(
    () => (selectedId ? filteredOrders.find((o) => o.id === selectedId) ?? null : null),
    [filteredOrders, selectedId]
  );

  async function cancelOrder(orderId: string) {
    setBusyOrderId(orderId);
    try {
      await updateDoc(doc(staffDb, "orders", orderId), {
        status: "cancelled",
        updatedAt: serverTimestamp()
      });
    } finally {
      setBusyOrderId(null);
    }
  }

  async function assignWaiter(orderId: string, waiter: StaffDirectoryRow) {
    setBusyOrderId(orderId);
    try {
      await updateDoc(doc(staffDb, "orders", orderId), {
        assignedWaiterUid: waiter.uid,
        assignedWaiterName: waiter.name,
        "assignedTo.waiterId": waiter.uid,
        updatedAt: serverTimestamp()
      });
    } finally {
      setBusyOrderId(null);
    }
  }

  function toggleTimeline(orderId: string) {
    setTimelineOpen((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function timelineRows(order: Record<string, unknown>): Array<{ label: string; at: unknown }> {
    return [
      { label: "Created", at: order.createdAt },
      { label: "Accepted", at: order.acceptedAt },
      { label: "Preparing", at: order.preparingAt },
      { label: "Ready", at: order.readyAt },
      { label: "Served / Completed", at: order.servedAt ?? order.completedAt ?? order.deliveredAt ?? order.doneAt }
    ].filter((row) => row.at != null);
  }

  return (
    <ManagerScaffold title="Orders" subtitle="View, search, filter, cancel, assign waiter, and track timeline">
      <View style={[styles.ordersToolbar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by id, token, customer, table..."
          placeholderTextColor={colors.textDisabled}
          style={[
            styles.searchInput,
            { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {ORDER_FILTERS.map((row) => {
              const active = filter === row.key;
              return (
                <Pressable
                  key={row.key}
                  onPress={() => setFilter(row.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primaryMuted : colors.hover,
                      borderColor: active ? colors.primary : colors.border
                    }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? colors.primary : colors.textSecondary }]}>
                    {row.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={[styles.loading, { color: colors.textSecondary }]}>
            {loading ? "Loading orders..." : "No orders match current filter/search."}
          </Text>
        }
        renderItem={({ item }) => {
          const order = item as Record<string, unknown>;
          const tone = statusTone(String(order.canonicalStatus ?? order.status ?? ""));
          const chipColor =
            tone === "success"
              ? colors.success
              : tone === "warning"
                ? colors.warning
                : tone === "info"
                  ? colors.info
                  : colors.textSecondary;
          const isSelected = selectedId === item.id;
          const timeline = timelineRows(order);
          const waiterId = String(order.assignedWaiterUid ?? (order.assignedTo as { waiterId?: string } | undefined)?.waiterId ?? "");
          const waiterName = String(order.assignedWaiterName ?? "");

          return (
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable onPress={() => setSelectedId(isSelected ? null : item.id)}>
                <View style={styles.listHead}>
                  <Text style={[styles.orderId, { color: colors.textPrimary }]}>
                    #{item.tokenNumber ?? item.id.slice(-6)}
                  </Text>
                  <View style={[styles.statusChip, { borderColor: chipColor, backgroundColor: `${chipColor}22` }]}>
                    <Text style={[styles.statusText, { color: chipColor }]}>
                      {String(order.canonicalStatus ?? order.status ?? "unknown")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  {item.customerName || item.customer?.name || "Walk-in"} · ₹{Math.round(item.totalAmount ?? 0)}
                </Text>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  {item.orderType ?? "order"} · {toDate(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  Waiter: {waiterName || (waiterId ? waiterId.slice(0, 8) : "Not assigned")}
                </Text>
              </Pressable>

              {isSelected ? (
                <View style={styles.orderActionBlock}>
                  <View style={styles.rowGap}>
                    <Pressable
                      onPress={() => void cancelOrder(item.id)}
                      disabled={busyOrderId === item.id}
                      style={[styles.secondaryButton, { borderColor: colors.danger, backgroundColor: colors.dangerMuted }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                        {busyOrderId === item.id ? "Cancelling..." : "Cancel"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => toggleTimeline(item.id)}
                      style={[styles.secondaryButton, { borderColor: colors.info, backgroundColor: colors.infoMuted }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.info }]}>View Timeline</Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.assignLabel, { color: colors.textSecondary }]}>Assign Waiter</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.rowGap}>
                      {waiters.length === 0 ? (
                        <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                          {waiterError || "No active waiter profiles found."}
                        </Text>
                      ) : (
                        waiters.map((waiter) => (
                          <Pressable
                            key={waiter.uid}
                            onPress={() => void assignWaiter(item.id, waiter)}
                            disabled={busyOrderId === item.id}
                            style={[
                              styles.waiterChip,
                              {
                                borderColor: waiterId === waiter.uid ? colors.primary : colors.border,
                                backgroundColor: waiterId === waiter.uid ? colors.primaryMuted : colors.hover
                              }
                            ]}
                          >
                            <Text
                              style={[
                                styles.waiterChipText,
                                { color: waiterId === waiter.uid ? colors.primary : colors.textSecondary }
                              ]}
                            >
                              {waiter.name}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  </ScrollView>

                  {timelineOpen.has(item.id) ? (
                    <View style={[styles.timelineCard, { borderColor: colors.border, backgroundColor: colors.hover }]}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Order Timeline</Text>
                      {timeline.length === 0 ? (
                        <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Timeline not available yet.</Text>
                      ) : (
                        timeline.map((row) => (
                          <View key={`${item.id}-${row.label}`} style={styles.timelineRow}>
                            <MaterialCommunityIcons name="clock-outline" size={15} color={colors.primary} />
                            <Text style={[styles.timelineText, { color: colors.textSecondary }]}>
                              {row.label} · {toDate(row.at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </ManagerScaffold>
  );
}

export function ManagerTablesScreen() {
  const { colors } = useMobileTheme();
  const router = useRouter();
  const { tables, loading } = useManagerModule();
  const { width } = useWindowDimensions();
  const numColumns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<"all" | "available" | "occupied" | "reserved" | "cleaning">("all");
  const [waiters, setWaiters] = useState<StaffDirectoryRow[]>([]);
  const [waiterUid, setWaiterUid] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [reserveName, setReserveName] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeStaffDirectory((rows) => {
      setWaiters(
        rows.filter(
          (row) =>
            row.isActive &&
            ["waiter", "service", "floor"].some((s) => row.roleLabel.toLowerCase().includes(s))
        )
      );
    });
    return () => unsub();
  }, []);

  const visibleTables = useMemo(
    () =>
      tableFilter === "all"
        ? tables
        : tables.filter((table) => table.uiStatus === tableFilter),
    [tables, tableFilter]
  );

  const selected = useMemo(
    () => (selectedTableId ? tables.find((table) => table.id === selectedTableId) ?? null : null),
    [selectedTableId, tables]
  );

  const transferCandidates = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.id !== selected?.id &&
          (table.uiStatus === "available" || table.uiStatus === "reserved")
      ),
    [tables, selected?.id]
  );

  async function handleAssignWaiter() {
    if (!selected || !waiterUid.trim()) return;
    const waiter = waiters.find((row) => row.uid === waiterUid.trim());
    if (!waiter) return;
    setBusy("assign");
    try {
      await updateDoc(doc(staffDb, "tables", selected.id), {
        assignedWaiterUid: waiter.uid,
        assignedWaiterName: waiter.name,
        updatedAt: serverTimestamp()
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleReserveTable() {
    if (!selected) return;
    setBusy("reserve");
    try {
      await updateDoc(doc(staffDb, "tables", selected.id), {
        status: "RESERVED",
        reservationName: reserveName.trim(),
        reservationNote: reserveNote.trim(),
        updatedAt: serverTimestamp()
      });
      setReserveName("");
      setReserveNote("");
    } finally {
      setBusy(null);
    }
  }

  async function handleTransferTable() {
    if (!selected || !selected.currentOrderId || !transferTargetId.trim()) return;
    const target = tables.find((table) => table.id === transferTargetId.trim());
    if (!target) return;
    setBusy("transfer");
    try {
      const batch = writeBatch(staffDb);
      batch.update(doc(staffDb, "tables", selected.id), {
        currentOrderId: null,
        status: "FREE",
        updatedAt: serverTimestamp()
      });
      batch.update(doc(staffDb, "tables", target.id), {
        currentOrderId: selected.currentOrderId,
        status: "OCCUPIED",
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      setTransferTargetId("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ManagerScaffold title="Tables" subtitle="Available, occupied, reserved, cleaning with manager actions">
      <View style={[styles.ordersToolbar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {(["all", "available", "occupied", "reserved", "cleaning"] as const).map((key) => {
              const active = tableFilter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTableFilter(key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primaryMuted : colors.hover,
                      borderColor: active ? colors.primary : colors.border
                    }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? colors.primary : colors.textSecondary }]}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <FlatList
        data={visibleTables}
        numColumns={numColumns}
        key={`${numColumns}`}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        columnWrapperStyle={numColumns > 1 ? styles.colWrap : undefined}
        ListEmptyComponent={
          <Text style={[styles.loading, { color: colors.textSecondary }]}>
            {loading ? "Loading floor..." : "No tables yet."}
          </Text>
        }
        renderItem={({ item }) => {
          const tone =
            item.uiStatus === "occupied"
              ? colors.warning
              : item.uiStatus === "reserved"
                ? colors.info
                : item.uiStatus === "cleaning"
                  ? colors.danger
                  : colors.success;
          const selectedCard = selected?.id === item.id;
          return (
            <Pressable
              onPress={() => setSelectedTableId(selectedCard ? null : item.id)}
              style={[
                styles.tableCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: selectedCard ? colors.primary : colors.border
                }
              ]}
            >
              <Text style={[styles.tableName, { color: colors.textPrimary }]}>{item.displayName || `Table ${item.number}`}</Text>
              <View style={[styles.statusChip, { borderColor: tone, backgroundColor: `${tone}22` }]}>
                <Text style={[styles.statusText, { color: tone }]}>
                  {item.uiStatus.charAt(0).toUpperCase() + item.uiStatus.slice(1)}
                </Text>
              </View>
              <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                {item.currentOrderId ? `Order ${item.currentOrderId.slice(-6)}` : "No running order"}
              </Text>
              <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                Waiter: {item.assignedWaiterName || (item.assignedWaiterUid ? item.assignedWaiterUid.slice(0, 8) : "—")}
              </Text>
            </Pressable>
          );
        }}
      />
      {selected ? (
        <View style={[styles.tableActionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Actions · {selected.displayName || `Table ${selected.number}`}
          </Text>

          <Text style={[styles.assignLabel, { color: colors.textSecondary }]}>Assign Waiter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.rowGap}>
              {waiters.map((waiter) => (
                <Pressable
                  key={waiter.uid}
                  onPress={() => setWaiterUid(waiter.uid)}
                  style={[
                    styles.waiterChip,
                    {
                      borderColor: waiterUid === waiter.uid ? colors.primary : colors.border,
                      backgroundColor: waiterUid === waiter.uid ? colors.primaryMuted : colors.hover
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.waiterChipText,
                      { color: waiterUid === waiter.uid ? colors.primary : colors.textSecondary }
                    ]}
                  >
                    {waiter.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable
            onPress={() => void handleAssignWaiter()}
            disabled={!waiterUid || busy !== null}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !waiterUid || busy ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{busy === "assign" ? "Assigning..." : "Assign Waiter"}</Text>
          </Pressable>

          <Text style={[styles.assignLabel, { color: colors.textSecondary }]}>Transfer Table</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.rowGap}>
              {transferCandidates.map((table) => (
                <Pressable
                  key={table.id}
                  onPress={() => setTransferTargetId(table.id)}
                  style={[
                    styles.waiterChip,
                    {
                      borderColor: transferTargetId === table.id ? colors.info : colors.border,
                      backgroundColor: transferTargetId === table.id ? colors.infoMuted : colors.hover
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.waiterChipText,
                      { color: transferTargetId === table.id ? colors.info : colors.textSecondary }
                    ]}
                  >
                    {table.displayName || `Table ${table.number}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable
            onPress={() => void handleTransferTable()}
            disabled={!transferTargetId || !selected.currentOrderId || busy !== null}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.info,
                opacity: !transferTargetId || !selected.currentOrderId || busy ? 0.6 : 1
              }
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy === "transfer" ? "Transferring..." : "Transfer Table"}</Text>
          </Pressable>

          <Text style={[styles.assignLabel, { color: colors.textSecondary }]}>Reserve Table</Text>
          <TextInput
            value={reserveName}
            onChangeText={setReserveName}
            placeholder="Reservation name"
            placeholderTextColor={colors.textDisabled}
            style={[
              styles.searchInput,
              { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }
            ]}
          />
          <TextInput
            value={reserveNote}
            onChangeText={setReserveNote}
            placeholder="Reservation note (optional)"
            placeholderTextColor={colors.textDisabled}
            style={[
              styles.searchInput,
              { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }
            ]}
          />
          <Pressable
            onPress={() => void handleReserveTable()}
            disabled={busy !== null}
            style={[styles.primaryButton, { backgroundColor: colors.warning, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{busy === "reserve" ? "Saving..." : "Reserve Table"}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              selected.currentOrderId
                ? router.push(`/manager/orders?focus=${encodeURIComponent(selected.currentOrderId)}` as never)
                : undefined
            }
            disabled={!selected.currentOrderId}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primaryMuted,
                opacity: selected.currentOrderId ? 1 : 0.6,
                marginTop: 10
              }
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>View Running Order</Text>
          </Pressable>
        </View>
      ) : null}
    </ManagerScaffold>
  );
}

export function ManagerKitchenScreen() {
  const { colors } = useMobileTheme();
  const { kitchenOrders, orders, loading } = useManagerModule();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const completedOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["completed", "done", "served", "delivered"].includes(
          String(order.canonicalStatus ?? order.status ?? "").toLowerCase()
        )
      ),
    [orders]
  );

  const kitchenMonitorRows = useMemo(() => {
    return kitchenOrders.map((order) => {
      const status = String(order.canonicalStatus ?? order.status ?? "").toLowerCase();
      const startAt = toDate((order as Record<string, unknown>).preparingAt ?? order.createdAt).getTime();
      const prepMinutes = Math.max(0, Math.round((clockTick - startAt) / 60000));
      const delayed = ["new", "pending", "accepted", "preparing"].includes(status) && prepMinutes >= 20;
      const assignedTo = ((order as Record<string, unknown>).assignedTo ?? {}) as Record<string, unknown>;
      const priority = String(assignedTo.priority ?? "").toLowerCase() === "high";
      return { order, status, prepMinutes, delayed, priority };
    });
  }, [kitchenOrders, clockTick]);

  const buckets = useMemo(() => {
    const preparing = kitchenMonitorRows.filter((row) => ["preparing", "accepted", "new", "pending"].includes(row.status));
    const ready = kitchenMonitorRows.filter((row) => row.status === "ready");
    const delayed = kitchenMonitorRows.filter((row) => row.delayed);
    const completed = completedOrders.slice(0, 50).map((order) => ({
      order,
      status: String(order.canonicalStatus ?? order.status ?? "").toLowerCase(),
      prepMinutes: Math.max(
        0,
        Math.round((toDate((order as Record<string, unknown>).completedAt ?? Date.now()).getTime() - toDate(order.createdAt).getTime()) / 60000)
      ),
      delayed: false,
      priority: false
    }));
    return { preparing, ready, delayed, completed };
  }, [kitchenMonitorRows, completedOrders]);

  const alertRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (buckets.delayed.length > 0) rows.push({ label: "Delayed Orders", value: `${buckets.delayed.length} orders crossing 20 min` });
    const priorityCount = kitchenMonitorRows.filter((r) => r.priority).length;
    if (priorityCount > 0) rows.push({ label: "Priority Queue", value: `${priorityCount} high-priority orders` });
    if (rows.length === 0) rows.push({ label: "Kitchen Alerts", value: "No active alerts. Queue is healthy." });
    return rows;
  }, [buckets.delayed.length, kitchenMonitorRows]);

  async function togglePriority(orderId: string, current: boolean) {
    setBusyId(orderId);
    try {
      const next = current ? "normal" : "high";
      await updateDoc(doc(staffDb, "orders", orderId), {
        "assignedTo.priority": next,
        updatedAt: serverTimestamp()
      });
    } finally {
      setBusyId(null);
    }
  }

  function renderMonitorBucket(
    title: string,
    rows: Array<{ order: any; status: string; prepMinutes: number; delayed: boolean; priority: boolean }>
  ) {
    return (
      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.listHead}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{rows.length}</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>No orders</Text>
        ) : (
          rows.map((row) => {
            const chipColor =
              row.status === "ready"
                ? colors.success
                : row.delayed
                  ? colors.danger
                  : row.status === "preparing"
                    ? colors.warning
                    : colors.info;
            return (
              <View
                key={`${title}-${row.order.id}`}
                style={[styles.timelineCard, { borderColor: colors.border, backgroundColor: colors.hover }]}
              >
                <View style={styles.listHead}>
                  <Text style={[styles.orderId, { color: colors.textPrimary }]}>
                    #{row.order.tokenNumber ?? row.order.id.slice(-6)}
                  </Text>
                  <View style={[styles.statusChip, { borderColor: chipColor, backgroundColor: `${chipColor}22` }]}>
                    <Text style={[styles.statusText, { color: chipColor }]}>{row.status}</Text>
                  </View>
                </View>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  Prep Time: {row.prepMinutes} min {row.delayed ? "· Delayed" : ""}
                </Text>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  {row.order.customerName || row.order.customer?.name || "Walk-in"} · ₹{Math.round(row.order.totalAmount ?? 0)}
                </Text>
                {title !== "Completed" ? (
                  <Pressable
                    onPress={() => void togglePriority(row.order.id, row.priority)}
                    disabled={busyId === row.order.id}
                    style={[
                      styles.secondaryButton,
                      {
                        borderColor: colors.primary,
                        backgroundColor: row.priority ? colors.primaryMuted : colors.hover,
                        marginTop: 8,
                        opacity: busyId === row.order.id ? 0.6 : 1
                      }
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                      {busyId === row.order.id
                        ? "Saving..."
                        : row.priority
                          ? "Prioritized (Tap to Normal)"
                          : "Prioritize"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    );
  }

  return (
    <ManagerScaffold title="Kitchen" subtitle="Preparing, ready, delayed, completed with manager controls">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Alerts</Text>
          {alertRows.map((row) => (
            <View key={row.label} style={styles.timelineRow}>
              <MaterialCommunityIcons name="bell-alert-outline" size={16} color={colors.warning} />
              <Text style={[styles.timelineText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{row.label}: </Text>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {renderMonitorBucket("Preparing", buckets.preparing)}
        {renderMonitorBucket("Ready", buckets.ready)}
        {renderMonitorBucket("Delayed", buckets.delayed)}
        {renderMonitorBucket("Completed", buckets.completed)}

        {loading ? <Text style={[styles.loading, { color: colors.textSecondary }]}>Loading kitchen monitor...</Text> : null}
      </ScrollView>
    </ManagerScaffold>
  );
}

export function ManagerMoreScreen() {
  const { colors, preference, setPreference } = useMobileTheme();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { isOnline, fromCache } = useManagerModule();

  return (
    <ManagerScaffold title="More" subtitle="Theme, account, and operational extras">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Theme</Text>
          <View style={styles.rowGap}>
            {(["light", "dark", "system"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => void setPreference(mode)}
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: preference === mode ? colors.primaryMuted : colors.hover,
                    borderColor: preference === mode ? colors.primary : colors.border
                  }
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    { color: preference === mode ? colors.primary : colors.textSecondary }
                  ]}
                >
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profile</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{profile?.name ?? "Manager"}</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{profile?.email ?? "No email"}</Text>
          <Pressable
            onPress={() => router.push("/profile")}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Open Profile</Text>
          </Pressable>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Offline Readiness</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            Connectivity: {isOnline ? "Online" : "Offline"}
          </Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            Cache fallback: {fromCache ? "Active (showing snapshot)" : "Live stream"}
          </Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            This module keeps cached manager data to remain usable during network disruptions.
          </Text>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reports</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            Lightweight mobile reports with optimized charts.
          </Text>
          <Pressable
            onPress={() => router.push("/manager/reports")}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Open Reports</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ManagerScaffold>
  );
}

export function ManagerStaffScreen() {
  const { colors } = useMobileTheme();
  const { tables } = useManagerModule();
  const [staffRows, setStaffRows] = useState<StaffDirectoryRow[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeStaffDirectory(
      (rows) => {
        setStaffRows(rows);
        setStaffError(null);
      },
      (err) => setStaffError(err.message)
    );
    return () => unsub();
  }, []);

  const assignedTablesByWaiter = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const table of tables) {
      const waiterUid = table.assignedWaiterUid?.trim();
      if (!waiterUid) continue;
      const label = table.displayName || `Table ${table.number}`;
      const prev = map.get(waiterUid) ?? [];
      map.set(waiterUid, [...prev, label]);
    }
    return map;
  }, [tables]);

  const groups = useMemo(() => {
    const isWaiter = (row: StaffDirectoryRow) =>
      row.roleNorm === "waiter" || row.roleLabel.toLowerCase().includes("waiter");
    const isCashier = (row: StaffDirectoryRow) =>
      row.roleNorm === "cashier" || row.roleLabel.toLowerCase().includes("cashier");
    const isKitchen = (row: StaffDirectoryRow) =>
      row.roleNorm === "kitchen" ||
      row.roleNorm === "kitchen_staff" ||
      row.roleLabel.toLowerCase().includes("kitchen");

    return {
      waiters: staffRows.filter(isWaiter),
      cashiers: staffRows.filter(isCashier),
      kitchen: staffRows.filter(isKitchen)
    };
  }, [staffRows]);

  const attendance = useMemo(() => {
    const total = staffRows.length;
    const online = staffRows.filter((row) => row.isActive).length;
    const offline = total - online;
    const clockedIn = staffRows.filter((row) => row.clockInAt && !row.clockOutAt).length;
    return { total, online, offline, clockedIn };
  }, [staffRows]);

  function renderRoleSection(title: string, rows: StaffDirectoryRow[]) {
    return (
      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.listHead}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{rows.length}</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>No staff found</Text>
        ) : (
          rows.map((row) => {
            const assignedTables = assignedTablesByWaiter.get(row.uid) ?? [];
            const shiftLabel = row.shift?.trim() || "General";
            const active = row.isActive;
            const activeColor = active ? colors.success : colors.textDisabled;
            return (
              <View
                key={`${title}-${row.uid}`}
                style={[styles.timelineCard, { borderColor: colors.border, backgroundColor: colors.hover }]}
              >
                <View style={styles.listHead}>
                  <Text style={[styles.orderId, { color: colors.textPrimary }]}>{row.name}</Text>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        borderColor: activeColor,
                        backgroundColor: `${activeColor}22`
                      }
                    ]}
                  >
                    <Text style={[styles.statusText, { color: activeColor }]}>{active ? "Online" : "Offline"}</Text>
                  </View>
                </View>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  Attendance: {row.clockInAt && !row.clockOutAt ? "Clocked In" : "Clocked Out"}
                </Text>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Current Shift: {shiftLabel}</Text>
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  Assigned Tables: {assignedTables.length > 0 ? assignedTables.join(", ") : "None"}
                </Text>
              </View>
            );
          })
        )}
      </View>
    );
  }

  return (
    <ManagerScaffold title="Staff" subtitle="Monitor waiters, cashiers, kitchen staff, attendance and shifts">
      <ScrollView contentContainerStyle={styles.content}>
        {staffError ? <Text style={[styles.error, { color: colors.danger }]}>{staffError}</Text> : null}

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Attendance Snapshot</Text>
          <View style={styles.metricGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.hover, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Online</Text>
              <Text style={[styles.metricValue, { color: colors.success }]}>{attendance.online}</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.hover, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Offline</Text>
              <Text style={[styles.metricValue, { color: colors.textDisabled }]}>{attendance.offline}</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.hover, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Clocked In</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>{attendance.clockedIn}</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.hover, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Staff</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{attendance.total}</Text>
            </View>
          </View>
        </View>

        {renderRoleSection("Waiters", groups.waiters)}
        {renderRoleSection("Cashiers", groups.cashiers)}
        {renderRoleSection("Kitchen Staff", groups.kitchen)}

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Monitoring Mode</Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            Manager can monitor staff only in this section (no create/edit/delete actions).
          </Text>
        </View>
      </ScrollView>
    </ManagerScaffold>
  );
}

export function ManagerNotificationsScreen() {
  const { colors } = useMobileTheme();
  const { orders, kitchenOrders } = useManagerModule();
  const notifications = useMemo(() => {
    const pending = orders.filter((order) => String(order.paymentStatus ?? "").toLowerCase() === "pending").length;
    return [
      { label: "Kitchen Queue Alerts", value: kitchenOrders.length },
      { label: "Pending Bills", value: pending },
      {
        label: "New Orders",
        value: orders.filter((order) => ["new", "pending"].includes((order.canonicalStatus ?? "").toLowerCase())).length
      }
    ];
  }, [orders, kitchenOrders]);

  return (
    <ManagerScaffold title="Notifications" subtitle="Realtime manager alerts">
      <ScrollView contentContainerStyle={styles.content}>
        {notifications.map((row) => (
          <View
            key={row.label}
            style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{row.label}</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>{row.value}</Text>
          </View>
        ))}
      </ScrollView>
    </ManagerScaffold>
  );
}

export function ManagerReportsScreen() {
  const { colors } = useMobileTheme();
  const { orders } = useManagerModule();

  const report = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayOrders = orders.filter((o) => toDate(o.createdAt).getTime() >= start);
    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
    const todayOrdersCount = todayOrders.length;
    const revenueOrders = orders.filter((o) => {
      const status = String(o.canonicalStatus ?? o.status ?? "").toLowerCase();
      const pay = String(o.paymentStatus ?? "").toLowerCase();
      return ["completed", "done", "served", "delivered"].includes(status) || pay === "paid";
    });
    const revenue = revenueOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
    const averageBill = todayOrdersCount > 0 ? todaySales / todayOrdersCount : 0;

    const itemMap = new Map<string, { name: string; qty: number; sales: number }>();
    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name = String((item as Record<string, unknown>).name ?? "Item").trim() || "Item";
        const qtyRaw = Number((item as Record<string, unknown>).qty ?? (item as Record<string, unknown>).quantity ?? 1);
        const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
        const price = Number((item as Record<string, unknown>).price ?? (item as Record<string, unknown>).unitPrice ?? 0);
        const prev = itemMap.get(name) ?? { name, qty: 0, sales: 0 };
        prev.qty += qty;
        prev.sales += qty * (Number.isFinite(price) ? price : 0);
        itemMap.set(name, prev);
      }
    }
    const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const kitchenPerf = (() => {
      let preparing = 0;
      let ready = 0;
      let delayed = 0;
      let completed = 0;
      for (const order of orders) {
        const status = String(order.canonicalStatus ?? order.status ?? "").toLowerCase();
        const prepStart = toDate((order as Record<string, unknown>).preparingAt ?? order.createdAt).getTime();
        const elapsed = Math.max(0, Math.round((Date.now() - prepStart) / 60000));
        if (["preparing", "accepted", "new", "pending"].includes(status)) preparing += 1;
        if (status === "ready") ready += 1;
        if (["completed", "done", "served", "delivered"].includes(status)) completed += 1;
        if (["new", "pending", "accepted", "preparing"].includes(status) && elapsed >= 20) delayed += 1;
      }
      return { preparing, ready, delayed, completed };
    })();

    const waiterMap = new Map<string, { label: string; orders: number; revenue: number }>();
    for (const order of orders) {
      const raw = order as Record<string, unknown>;
      const waiterUid = String(raw.assignedWaiterUid ?? (raw.assignedTo as { waiterId?: string } | undefined)?.waiterId ?? "").trim();
      const waiterName = String(raw.assignedWaiterName ?? "").trim();
      if (!waiterUid && !waiterName) continue;
      const key = waiterUid || waiterName;
      const label = waiterName || `Waiter ${key.slice(0, 6)}`;
      const prev = waiterMap.get(key) ?? { label, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += Number(order.totalAmount ?? 0);
      waiterMap.set(key, prev);
    }
    const waiterPerformance = [...waiterMap.values()].sort((a, b) => b.orders - a.orders).slice(0, 5);

    return {
      todaySales,
      todayOrdersCount,
      revenue,
      averageBill,
      topItems,
      kitchenPerf,
      waiterPerformance
    };
  }, [orders]);

  const maxTopQty = Math.max(1, ...report.topItems.map((row) => row.qty));
  const maxKitchen = Math.max(
    1,
    report.kitchenPerf.preparing,
    report.kitchenPerf.ready,
    report.kitchenPerf.delayed,
    report.kitchenPerf.completed
  );
  const maxWaiterOrders = Math.max(1, ...report.waiterPerformance.map((row) => row.orders));

  return (
    <ManagerScaffold title="Reports" subtitle="Lightweight mobile reports with compact charts">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Today's Sales</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>₹{Math.round(report.todaySales)}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Today's Orders</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{report.todayOrdersCount}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Revenue</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>₹{Math.round(report.revenue)}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Average Bill</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>₹{Math.round(report.averageBill)}</Text>
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Selling Items</Text>
          {report.topItems.length === 0 ? (
            <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>No item data yet.</Text>
          ) : (
            report.topItems.map((row) => {
              const pct = Math.max(6, Math.round((row.qty / maxTopQty) * 100));
              return (
                <View key={row.name} style={styles.chartRow}>
                  <View style={styles.chartRowHead}>
                    <Text style={[styles.orderMeta, { color: colors.textPrimary }]}>{row.name}</Text>
                    <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{row.qty}</Text>
                  </View>
                  <View style={[styles.chartTrack, { backgroundColor: colors.hover }]}>
                    <View style={[styles.chartFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Kitchen Performance</Text>
          {(
            [
              ["Preparing", report.kitchenPerf.preparing, colors.warning],
              ["Ready", report.kitchenPerf.ready, colors.success],
              ["Delayed", report.kitchenPerf.delayed, colors.danger],
              ["Completed", report.kitchenPerf.completed, colors.info]
            ] as Array<[string, number, string]>
          ).map(([label, value, color]) => {
            const pct = Math.max(6, Math.round((value / maxKitchen) * 100));
            return (
              <View key={label} style={styles.chartRow}>
                <View style={styles.chartRowHead}>
                  <Text style={[styles.orderMeta, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>{value}</Text>
                </View>
                <View style={[styles.chartTrack, { backgroundColor: colors.hover }]}>
                  <View style={[styles.chartFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Waiter Performance</Text>
          {report.waiterPerformance.length === 0 ? (
            <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>No waiter assignment data yet.</Text>
          ) : (
            report.waiterPerformance.map((row) => {
              const pct = Math.max(6, Math.round((row.orders / maxWaiterOrders) * 100));
              return (
                <View key={row.label} style={styles.chartRow}>
                  <View style={styles.chartRowHead}>
                    <Text style={[styles.orderMeta, { color: colors.textPrimary }]}>{row.label}</Text>
                    <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                      {row.orders} orders · ₹{Math.round(row.revenue)}
                    </Text>
                  </View>
                  <View style={[styles.chartTrack, { backgroundColor: colors.hover }]}>
                    <View style={[styles.chartFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ManagerScaffold>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "500" },
  refreshPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  refreshText: { fontSize: 12, fontWeight: "700" },
  badgeRow: { marginTop: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  syncText: { fontSize: 11, fontWeight: "600" },
  content: { paddingHorizontal: 14, paddingBottom: 32, gap: 10 },
  error: { fontSize: 12, fontWeight: "700" },
  ordersToolbar: { marginHorizontal: 14, borderWidth: 1, borderRadius: 18, padding: 10, gap: 8 },
  searchInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: "500" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  filterChipText: { fontSize: 12, fontWeight: "700" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    minHeight: 96
  },
  quickCard: { borderRadius: 20, borderWidth: 1, padding: 12, marginTop: 2 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  quickAction: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  quickActionText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  metricLabel: { marginTop: 6, fontSize: 12, fontWeight: "600" },
  metricValue: { marginTop: 3, fontSize: 21, fontWeight: "800" },
  loading: { textAlign: "center", marginTop: 14, fontSize: 13, fontWeight: "600" },
  listCard: { borderRadius: 18, borderWidth: 1, padding: 12 },
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  orderId: { fontSize: 16, fontWeight: "800" },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  orderMeta: { marginTop: 4, fontSize: 12, fontWeight: "500" },
  orderActionBlock: { marginTop: 10, gap: 8 },
  secondaryButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  secondaryButtonText: { fontSize: 12, fontWeight: "700" },
  assignLabel: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  waiterChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  waiterChipText: { fontSize: 12, fontWeight: "700" },
  timelineCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 4 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  timelineText: { fontSize: 12, fontWeight: "500" },
  chartRow: { marginTop: 8 },
  chartRowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  chartTrack: { height: 8, borderRadius: 999, overflow: "hidden", marginTop: 6 },
  chartFill: { height: "100%", borderRadius: 999 },
  colWrap: { gap: 10 },
  tableCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 10 },
  tableActionsCard: { marginHorizontal: 14, marginBottom: 12, borderWidth: 1, borderRadius: 18, padding: 12 },
  tableName: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  rowGap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderRadius: 999, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 12 },
  choiceText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  primaryButton: { marginTop: 10, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" }
});
