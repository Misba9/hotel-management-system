import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatSource } from "../../src/lib/kitchen-kds";
import { historyDisplayStatus, type KitchenHistoryOrder } from "../../src/lib/kitchen-order-mapper";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";
import { getGridColumnCount } from "../../src/lib/responsive";

export type HistoryDateFilter = "today" | "yesterday" | "week" | "month" | "all";
export type HistoryStatusFilter = "all" | "completed" | "cancelled";
export type HistorySourceFilter = "all" | "parcel" | "dine_in" | "swiggy" | "zomato" | "online";

type Props = {
  orders: KitchenHistoryOrder[];
};

type FilterDraft = {
  date: HistoryDateFilter;
  status: HistoryStatusFilter;
  source: HistorySourceFilter;
};

const DATE_OPTIONS: Array<{ id: HistoryDateFilter; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" }
];

const STATUS_OPTIONS: Array<{ id: HistoryStatusFilter; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" }
];

const SOURCE_OPTIONS: Array<{ id: HistorySourceFilter; label: string }> = [
  { id: "all", label: "All sources" },
  { id: "parcel", label: "Parcel / Takeaway" },
  { id: "dine_in", label: "Dine-in" },
  { id: "swiggy", label: "Swiggy" },
  { id: "zomato", label: "Zomato" }
];

const DEFAULT_FILTERS: FilterDraft = {
  date: "today",
  status: "all",
  source: "all"
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inDateRange(iso: string, filter: HistoryDateFilter): boolean {
  if (filter === "all") return true;
  const ts = new Date(iso).getTime();
  const now = new Date();
  const todayStart = startOfDay(now).getTime();

  if (filter === "today") return ts >= todayStart;

  const yesterdayStart = todayStart - 86400000;
  if (filter === "yesterday") return ts >= yesterdayStart && ts < todayStart;

  if (filter === "week") {
    const weekStart = todayStart - 6 * 86400000;
    return ts >= weekStart;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return ts >= monthStart;
}

function matchesSource(order: KitchenHistoryOrder, filter: HistorySourceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "swiggy") return order.source === "swiggy";
  if (filter === "zomato") return order.source === "zomato";
  if (filter === "dine_in") {
    return order.source === "dine-in" || order.orderType === "dine_in" || order.orderType === "table";
  }
  if (filter === "parcel") {
    return order.orderType === "parcel" || order.orderType === "takeaway" || order.source === "takeaway";
  }
  if (filter === "online") {
    const ot = (order.orderType ?? "").toLowerCase();
    return ot === "online" || ot === "website" || ot === "qr" || ot === "phone";
  }
  return true;
}

function matchesSearch(order: KitchenHistoryOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (order.orderId.toLowerCase().includes(q)) return true;
  if (order.orderNumber.toLowerCase().includes(q)) return true;
  if (order.tableNumber?.toLowerCase().includes(q)) return true;
  if (order.customerName?.toLowerCase().includes(q)) return true;
  return false;
}

function optionLabel<T extends string>(
  options: Array<{ id: T; label: string }>,
  id: T
): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

function countActiveFilters(filters: FilterDraft): number {
  let n = 0;
  if (filters.date !== DEFAULT_FILTERS.date) n += 1;
  if (filters.status !== DEFAULT_FILTERS.status) n += 1;
  if (filters.source !== DEFAULT_FILTERS.source) n += 1;
  return n;
}

function RadioRow({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
      <MaterialIcons
        name={selected ? "radio-button-checked" : "radio-button-unchecked"}
        size={22}
        color={selected ? "#ea580c" : "#64748b"}
      />
    </Pressable>
  );
}

export function KitchenHistoryPanel({ orders }: Props) {
  const insets = useSafeAreaInsets();
  const { padding, width } = useResponsiveLayout();
  const columns = getGridColumnCount(width, { phone: 1, tablet: 2, largeTablet: 3 });
  const [filters, setFilters] = useState<FilterDraft>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterDraft>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (!inDateRange(order.completedAt ?? order.createdAt, filters.date)) return false;
      if (filters.status === "completed" && order.historyStatus !== "completed") return false;
      if (filters.status === "cancelled" && order.historyStatus !== "cancelled") return false;
      if (!matchesSource(order, filters.source)) return false;
      return matchesSearch(order, search);
    });
  }, [orders, filters, search]);

  const openSheet = () => {
    setDraft(filters);
    setSheetOpen(true);
  };

  const applyFilters = () => {
    setFilters(draft);
    setSheetOpen(false);
  };

  const resetDraft = () => setDraft(DEFAULT_FILTERS);

  const resetAll = () => {
    setFilters(DEFAULT_FILTERS);
    setDraft(DEFAULT_FILTERS);
  };

  const summaryParts = [
    optionLabel(DATE_OPTIONS, filters.date),
    filters.status !== "all" ? optionLabel(STATUS_OPTIONS, filters.status) : null,
    filters.source !== "all" ? optionLabel(SOURCE_OPTIONS, filters.source) : null
  ].filter(Boolean);

  return (
    <View style={[styles.wrap, { paddingHorizontal: padding }]}>
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search order, table, customer…"
            placeholderTextColor="#64748b"
            style={styles.search}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <Pressable
          onPress={openSheet}
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <MaterialIcons name="tune" size={20} color="#f8fafc" />
          {activeCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Pressable onPress={openSheet} style={styles.summaryBar}>
        <Text style={styles.summaryText} numberOfLines={1}>
          {summaryParts.join(" · ")}
        </Text>
        <Text style={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? "order" : "orders"}
        </Text>
      </Pressable>

      {activeCount > 0 ? (
        <Pressable onPress={resetAll} style={styles.clearLink} hitSlop={8}>
          <Text style={styles.clearLinkText}>Clear filters</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={filtered}
        key={`history-${columns}`}
        numColumns={columns}
        keyExtractor={(o) => o.orderId}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
        ListEmptyComponent={<Text style={styles.empty}>No history for these filters</Text>}
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.gridCell : styles.gridCellSingle}>
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.orderNo}>{item.orderNumber}</Text>
                <View
                  style={[
                    styles.statusChip,
                    item.historyStatus === "cancelled" ? styles.statusCancelled : styles.statusDone
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      item.historyStatus === "cancelled" && styles.statusCancelledText
                    ]}
                  >
                    {historyDisplayStatus(item)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {formatSource(item.source)}
                {item.tableNumber ? ` · Table ${item.tableNumber}` : ""}
              </Text>
              {item.customerName ? <Text style={styles.customer}>{item.customerName}</Text> : null}
              <Text style={styles.total}>₹{item.total.toFixed(0)}</Text>
            </View>
          </View>
        )}
      />

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Pressable onPress={resetDraft} hitSlop={10}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.sectionLabel}>Date range</Text>
              <View style={styles.sectionCard}>
                {DATE_OPTIONS.map((opt) => (
                  <RadioRow
                    key={opt.id}
                    label={opt.label}
                    selected={draft.date === opt.id}
                    onPress={() => setDraft((d) => ({ ...d, date: opt.id }))}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.sectionCard}>
                {STATUS_OPTIONS.map((opt) => (
                  <RadioRow
                    key={opt.id}
                    label={opt.label}
                    selected={draft.status === opt.id}
                    onPress={() => setDraft((d) => ({ ...d, status: opt.id }))}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Source</Text>
              <View style={styles.sectionCard}>
                {SOURCE_OPTIONS.map((opt) => (
                  <RadioRow
                    key={opt.id}
                    label={opt.label}
                    selected={draft.source === opt.id}
                    onPress={() => setDraft((d) => ({ ...d, source: opt.id }))}
                  />
                ))}
              </View>
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setSheetOpen(false)}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={applyFilters}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Apply filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", alignSelf: "stretch" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingHorizontal: 12
  },
  searchIcon: { marginRight: 6 },
  search: {
    flex: 1,
    minHeight: 44,
    color: "#f8fafc",
    fontSize: 15,
    paddingVertical: 8
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center"
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#172033",
    borderWidth: 1,
    borderColor: "#273449"
  },
  summaryText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#cbd5e1" },
  resultCount: { fontSize: 12, fontWeight: "700", color: "#94a3b8" },
  clearLink: { alignSelf: "flex-start", marginBottom: 8 },
  clearLinkText: { fontSize: 13, fontWeight: "700", color: "#fb923c" },
  list: { paddingBottom: 32, width: "100%", flexGrow: 1 },
  gridRow: { gap: 12 },
  gridCell: { flex: 1, minWidth: 0, marginBottom: 4 },
  gridCellSingle: { width: "100%", marginBottom: 4 },
  row: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderNo: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusDone: { backgroundColor: "#e2e8f0" },
  statusCancelled: { backgroundColor: "#fee2e2" },
  statusChipText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  statusCancelledText: { color: "#991b1b" },
  meta: { marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: "600" },
  customer: { marginTop: 4, fontSize: 14, color: "#334155" },
  total: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#0f172a" },
  empty: { textAlign: "center", marginTop: 40, color: "#64748b", fontSize: 15 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,6,23,0.62)" },
  sheet: {
    maxHeight: "82%",
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingTop: 8
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
    marginBottom: 10
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 8
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#f8fafc" },
  resetText: { fontSize: 14, fontWeight: "700", color: "#fb923c" },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionLabel: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  sectionCard: {
    borderRadius: 14,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden"
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#334155"
  },
  radioLabel: { fontSize: 15, fontWeight: "600", color: "#cbd5e1" },
  radioLabelActive: { color: "#fff", fontWeight: "800" },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155"
  },
  secondaryBtnText: { color: "#e2e8f0", fontWeight: "800", fontSize: 15 },
  primaryBtn: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ea580c"
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  pressed: { opacity: 0.88 }
});
