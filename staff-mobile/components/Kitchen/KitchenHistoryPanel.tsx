import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatSource } from "../../src/lib/kitchen-kds";
import { historyDisplayStatus, type KitchenHistoryOrder } from "../../src/lib/kitchen-order-mapper";

export type HistoryDateFilter = "today" | "yesterday" | "week" | "month" | "all";
export type HistoryStatusFilter = "all" | "completed" | "cancelled";
export type HistorySourceFilter = "all" | "parcel" | "dine_in" | "swiggy" | "zomato" | "online";

type Props = {
  orders: KitchenHistoryOrder[];
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

function FilterChip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function KitchenHistoryPanel({ orders }: Props) {
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<HistorySourceFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (!inDateRange(order.completedAt ?? order.createdAt, dateFilter)) return false;
      if (statusFilter === "completed" && order.historyStatus !== "completed") return false;
      if (statusFilter === "cancelled" && order.historyStatus !== "cancelled") return false;
      if (!matchesSource(order, sourceFilter)) return false;
      return matchesSearch(order, search);
    });
  }, [orders, dateFilter, statusFilter, sourceFilter, search]);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search order, table, customer…"
        placeholderTextColor="#64748b"
        style={styles.search}
      />

      <View style={styles.filterRow}>
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "Week"],
            ["month", "Month"]
          ] as const
        ).map(([id, label]) => (
          <FilterChip key={id} label={label} active={dateFilter === id} onPress={() => setDateFilter(id)} />
        ))}
      </View>

      <View style={styles.filterRow}>
        {(
          [
            ["all", "All"],
            ["completed", "Done"],
            ["cancelled", "Cancelled"]
          ] as const
        ).map(([id, label]) => (
          <FilterChip
            key={id}
            label={label}
            active={statusFilter === id}
            onPress={() => setStatusFilter(id)}
          />
        ))}
      </View>

      <View style={styles.filterRow}>
        {(
          [
            ["all", "All"],
            ["parcel", "Parcel"],
            ["dine_in", "Dine-in"],
            ["swiggy", "Swiggy"],
            ["zomato", "Zomato"]
          ] as const
        ).map(([id, label]) => (
          <FilterChip
            key={id}
            label={label}
            active={sourceFilter === id}
            onPress={() => setSourceFilter(id)}
          />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.orderId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No history for these filters</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.orderNo}>{item.orderNumber}</Text>
              <View
                style={[
                  styles.statusChip,
                  item.historyStatus === "cancelled" ? styles.statusCancelled : styles.statusDone
                ]}
              >
                <Text style={styles.statusChipText}>{historyDisplayStatus(item)}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {formatSource(item.source)}
              {item.tableNumber ? ` · Table ${item.tableNumber}` : ""}
            </Text>
            {item.customerName ? <Text style={styles.customer}>{item.customerName}</Text> : null}
            <Text style={styles.total}>₹{item.total.toFixed(0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    paddingHorizontal: 14,
    fontSize: 15
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155"
  },
  chipActive: { backgroundColor: "#ea580c", borderColor: "#fb923c" },
  chipPressed: { opacity: 0.9 },
  chipText: { fontSize: 12, fontWeight: "700", color: "#94a3b8" },
  chipTextActive: { color: "#fff" },
  list: { paddingBottom: 32 },
  row: {
    marginHorizontal: 16,
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
  statusDone: { backgroundColor: "#dcfce7" },
  statusCancelled: { backgroundColor: "#fee2e2" },
  statusChipText: { fontSize: 12, fontWeight: "800", color: "#166534" },
  meta: { marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: "600" },
  customer: { marginTop: 4, fontSize: 14, color: "#334155" },
  total: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#0f172a" },
  empty: { textAlign: "center", marginTop: 40, color: "#64748b", fontSize: 15 }
});
