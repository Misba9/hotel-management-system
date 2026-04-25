import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { OrderCard, type OrderCardAction } from "../OrderCard";
import {
  assignDeliveryBoyToOrder,
  isDeliveryRiderRow,
  subscribeStaffDirectory,
  type StaffDirectoryRow
} from "../../services/manager";
import { subscribeRecentOrders, type StaffOrderRow } from "../../services/orders";
import { useAuthStore } from "../../store/useAuthStore";

type StatusFilter = "all" | "pending" | "preparing" | "ready" | "served" | "other";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
  { key: "other", label: "Other" }
];

function StatusBarChart({
  pending,
  preparing,
  ready,
  served,
  other
}: {
  pending: number;
  preparing: number;
  ready: number;
  served: number;
  other: number;
}) {
  const max = Math.max(1, pending, preparing, ready, served, other);
  const barH = 72;
  const rows = [
    { key: "pending", label: "Pending", n: pending, color: "#fecaca" },
    { key: "preparing", label: "Prep", n: preparing, color: "#fed7aa" },
    { key: "ready", label: "Ready", n: ready, color: "#bbf7d0" },
    { key: "served", label: "Served", n: served, color: "#cbd5e1" },
    { key: "other", label: "Other", n: other, color: "#e2e8f0" }
  ];
  return (
    <View style={chartStyles.wrap}>
      {rows.map((r) => (
        <View key={r.key} style={chartStyles.col}>
          <View style={[chartStyles.track, { height: barH }]}>
            <View
              style={[
                chartStyles.fill,
                {
                  height: Math.max(4, (r.n / max) * barH),
                  backgroundColor: r.color
                }
              ]}
            />
          </View>
          <Text style={chartStyles.n}>{r.n}</Text>
          <Text style={chartStyles.lbl}>{r.label}</Text>
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingVertical: 8, gap: 4 },
  col: { flex: 1, alignItems: "center" },
  track: {
    width: "100%",
    maxWidth: 36,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  fill: { width: "100%", borderRadius: 8 },
  n: { marginTop: 6, fontSize: 13, fontWeight: "800", color: "#0f172a" },
  lbl: { marginTop: 2, fontSize: 10, fontWeight: "700", color: "#64748b", textAlign: "center" }
});

type ListHeaderProps = {
  metrics: { pending: number; preparing: number; ready: number; served: number; other: number; total: number };
  staff: StaffDirectoryRow[];
  staffErr: string | null;
  statusFilter: StatusFilter;
  onFilter: (f: StatusFilter) => void;
  error: string | null;
};

function DashboardListHeader({ metrics, staff, staffErr, statusFilter, onFilter, error }: ListHeaderProps) {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.heading}>Manager dashboard</Text>
      <Text style={styles.sub}>
        Recent orders (newest {metrics.total} in Firestore). Analytics reflect this window only.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Analytics</Text>
        <Text style={styles.totalLine}>Total orders: {metrics.total}</Text>
        <StatusBarChart
          pending={metrics.pending}
          preparing={metrics.preparing}
          ready={metrics.ready}
          served={metrics.served}
          other={metrics.other}
        />
        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{metrics.pending}</Text>
            <Text style={styles.statKey}>Pending</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{metrics.preparing}</Text>
            <Text style={styles.statKey}>Preparing</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{metrics.ready}</Text>
            <Text style={styles.statKey}>Ready</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{metrics.served}</Text>
            <Text style={styles.statKey}>Served</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Staff activity</Text>
        {staffErr ? <Text style={styles.error}>{staffErr}</Text> : null}
        <Text style={styles.staffHint}>
          Live roster from{" "}
          <Text style={styles.mono}>staff_users</Text>. Green = active account.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRow}>
          {staff.map((s) => (
            <View key={s.uid} style={styles.staffChip}>
              <View style={[styles.dot, s.isActive ? styles.dotOn : styles.dotOff]} />
              <Text style={styles.staffName} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.staffRole} numberOfLines={1}>
                {s.roleLabel}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.listHeading}>Orders</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUS_FILTERS.map((f) => {
          const on = statusFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => onFilter(f.key)}
              style={[styles.filterChip, on && styles.filterChipOn]}
            >
              <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ManagerDashboardView() {
  const role = useAuthStore((s) => s.role);
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OrderCardAction | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assignOrder, setAssignOrder] = useState<StaffOrderRow | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeRecentOrders(
      (next) => {
        setOrders(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeStaffDirectory(
      (rows) => {
        setStaff(rows);
        setStaffErr(null);
      },
      (err) => {
        setStaffErr(err.message);
      }
    );
    return unsub;
  }, []);

  const metrics = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let served = 0;
    let other = 0;
    for (const o of orders) {
      const c = (o.canonicalStatus ?? "pending").toLowerCase();
      if (c === "pending") pending += 1;
      else if (c === "preparing") preparing += 1;
      else if (c === "ready") ready += 1;
      else if (c === "served") served += 1;
      else other += 1;
    }
    return { pending, preparing, ready, served, other, total: orders.length };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    if (statusFilter === "other") {
      return orders.filter((o) => {
        const c = (o.canonicalStatus ?? "").toLowerCase();
        return !["pending", "preparing", "ready", "served"].includes(c);
      });
    }
    return orders.filter((o) => (o.canonicalStatus ?? "").toLowerCase() === statusFilter);
  }, [orders, statusFilter]);

  const riders = useMemo(() => staff.filter(isDeliveryRiderRow).filter((r) => r.isActive), [staff]);

  const effectiveRole = role === "manager" ? "manager" : "admin";

  const onPickRider = useCallback(
    async (riderUid: string) => {
      if (!assignOrder) return;
      setAssignBusy(true);
      setAssignErr(null);
      try {
        await assignDeliveryBoyToOrder(assignOrder, riderUid);
        setAssignOrder(null);
      } catch (e) {
        setAssignErr(e instanceof Error ? e.message : "Assign failed");
      } finally {
        setAssignBusy(false);
      }
    },
    [assignOrder]
  );

  const listHeader = useMemo(
    () => (
      <DashboardListHeader
        metrics={metrics}
        staff={staff}
        staffErr={staffErr}
        statusFilter={statusFilter}
        onFilter={setStatusFilter}
        error={error}
      />
    ),
    [metrics, staff, staffErr, statusFilter, error]
  );

  return (
    <View style={styles.screen}>
      {loading && orders.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <View style={styles.orderWrap}>
            <OrderCard
              order={item}
              role={effectiveRole}
              busyAction={busy}
              onBusy={setBusy}
              onUpdated={() => undefined}
            />
            <Pressable style={styles.assignBtn} onPress={() => setAssignOrder(item)}>
              <Text style={styles.assignBtnText}>Assign delivery rider…</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No orders in this filter.</Text>
          ) : (
            <Text style={styles.empty}> </Text>
          )
        }
      />

      <Modal visible={assignOrder !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign rider</Text>
            {assignOrder ? (
              <Text style={styles.modalSub} numberOfLines={2}>
                Order #{assignOrder.id.slice(0, 8)} · {assignOrder.customer?.name || "Customer"}
              </Text>
            ) : null}
            {assignErr ? <Text style={styles.assignErr}>{assignErr}</Text> : null}
            {riders.length === 0 ? (
              <Text style={styles.muted}>No active delivery profiles. Add users with role delivery in Firestore.</Text>
            ) : (
              <FlatList
                data={riders}
                keyExtractor={(r) => r.uid}
                style={styles.riderList}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.riderRow, assignBusy && styles.disabled]}
                    disabled={assignBusy}
                    onPress={() => void onPickRider(item.uid)}
                  >
                    <Text style={styles.riderName}>{item.name}</Text>
                    <Text style={styles.riderEmail} numberOfLines={1}>
                      {item.email || item.uid.slice(0, 8)}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            {assignBusy ? <ActivityIndicator style={{ marginTop: 12 }} color="#0f172a" /> : null}
            <Pressable
              style={styles.modalClose}
              onPress={() => {
                if (assignBusy) return;
                setAssignErr(null);
                setAssignOrder(null);
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  headerBlock: { paddingBottom: 8 },
  heading: { fontSize: 24, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, paddingTop: 16 },
  sub: { fontSize: 13, color: "#64748b", paddingHorizontal: 16, marginBottom: 10, lineHeight: 18 },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 8 },
  cardBlock: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: 8 },
  totalLine: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  statCell: {
    width: "22%",
    minWidth: 72,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  statVal: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  statKey: { fontSize: 10, fontWeight: "700", color: "#64748b", marginTop: 2 },
  staffHint: { fontSize: 12, color: "#64748b", marginBottom: 10 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  staffRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  staffChip: {
    width: 132,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  dotOn: { backgroundColor: "#22c55e" },
  dotOff: { backgroundColor: "#cbd5e1" },
  staffName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  staffRole: { fontSize: 11, color: "#64748b", marginTop: 2 },
  listHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8
  },
  filterScroll: { maxHeight: 44, marginBottom: 8, paddingLeft: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8
  },
  filterChipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  filterChipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  filterChipTextOn: { color: "#fff" },
  list: { paddingBottom: 32 },
  orderWrap: { marginBottom: 4 },
  assignBtn: { marginHorizontal: 16, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 12 },
  assignBtnText: { fontSize: 14, fontWeight: "800", color: "#2563eb" },
  empty: { textAlign: "center", marginTop: 24, color: "#64748b", paddingHorizontal: 16 },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%"
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  modalSub: { fontSize: 14, color: "#64748b", marginTop: 6, marginBottom: 12 },
  muted: { fontSize: 14, color: "#64748b" },
  assignErr: { color: "#b91c1c", fontSize: 13, marginBottom: 10, fontWeight: "600" },
  riderList: { maxHeight: 280 },
  riderRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  riderName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  riderEmail: { fontSize: 12, color: "#64748b", marginTop: 4 },
  modalClose: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  modalCloseText: { fontSize: 16, fontWeight: "800", color: "#475569" },
  disabled: { opacity: 0.5 }
});
