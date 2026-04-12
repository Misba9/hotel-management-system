import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import { Button, StatCard } from "../components/shell";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { EmptyState } from "../components/ux/empty-state";
import { subscribeToOrders } from "../services/orders.js";
import { space } from "../theme/design-tokens";
import { shell, shellShadow } from "../theme/shell-theme";

const MOCK_STAFF = [
  { id: "1", name: "Neha — Kitchen", role: "kitchen" },
  { id: "2", name: "Vikram — Cashier", role: "cashier" },
  { id: "3", name: "Imran — Delivery", role: "delivery" }
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const ManagerOrderRow = React.memo(function ManagerOrderRow({ order }) {
  return (
    <View style={[styles.orderRow, shellShadow(1)]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderId}>{order.id.length > 12 ? `${order.id.slice(0, 10)}…` : order.id}</Text>
        <Text style={styles.orderMeta}>
          ₹{Math.round(order.totalAmount)} · {order.items.length} line(s)
        </Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{order.status.replace(/_/g, " ")}</Text>
      </View>
    </View>
  );
});

/**
 * Manager home — live metrics from unified `orders`.
 */
export default function ManagerDashboard() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [hasSynced, setHasSynced] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listenerKey, setListenerKey] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    const unsub = subscribeToOrders(
      (list) => {
        setHasSynced(true);
        setRefreshing(false);
        setOrders(list);
      },
      (err) => {
        setHasSynced(true);
        setRefreshing(false);
        const code = err instanceof FirebaseError ? err.code : "";
        setError(
          code === "permission-denied"
            ? "No permission to read orders (manager role + Firestore rules)."
            : err?.message ?? "Could not sync orders."
        );
      }
    );
    return unsub;
  }, [listenerKey]);

  const bumpListener = useCallback(() => {
    setListenerKey((k) => k + 1);
  }, []);

  const onRetryAfterError = useCallback(() => {
    setError(null);
    setRefreshing(true);
    bumpListener();
  }, [bumpListener]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    bumpListener();
  }, [bumpListener]);

  const { ordersToday, revenue, activeOrders } = useMemo(() => {
    const t0 = startOfToday().getTime();
    let today = 0;
    let rev = 0;
    let active = 0;
    const terminal = new Set(["delivered", "cancelled", "rejected"]);
    for (const o of orders) {
      const c = o.createdAt?.toDate?.();
      if (c && c.getTime() >= t0) today += 1;
      if (o.status === "delivered") rev += o.totalAmount;
      if (!terminal.has(o.status)) active += 1;
    }
    return { ordersToday: today, revenue: rev, activeOrders: active };
  }, [orders]);

  if (!hasSynced && !error) {
    return (
      <SafeAreaView style={styles.safe}>
        <StaffLoadingView message="Syncing live metrics…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {error ? (
        <View style={styles.errorPad}>
          <StaffErrorView message={error} onRetry={onRetryAfterError} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={shell.primary}
            colors={[shell.primary]}
          />
        }
      >
        <Text style={styles.hello}>Manager</Text>
        <Text style={styles.sub}>Live Firestore · staff POS pipeline · pull to refresh</Text>

        <View style={styles.statsRow}>
          <StatCard label="Orders today" value={ordersToday} accentColor={shell.primary} hint="staff POS" />
          <StatCard
            label="Revenue (delivered)"
            value={`₹${Math.round(revenue).toLocaleString()}`}
            accentColor={shell.success}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Active orders" value={activeOrders} accentColor={shell.orange} hint="non-terminal" />
        </View>

        <View style={[styles.quick, shellShadow(3)]}>
          <Text style={styles.quickTitle}>Quick actions</Text>
          <View style={styles.quickRow}>
            <Button
              title="Add staff"
              onPress={() => Alert.alert("Add staff", "Use the admin dashboard to invite staff.")}
              variant="primary"
              style={styles.quickBtn}
            />
            <Button
              title="View reports"
              onPress={() => Alert.alert("Reports", "Open Analytics tab or admin web console.")}
              variant="secondary"
              style={styles.quickBtn}
            />
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab("orders")} style={[styles.tab, tab === "orders" && styles.tabOn]}>
            <Text style={[styles.tabText, tab === "orders" && styles.tabTextOn]}>Orders</Text>
          </Pressable>
          <Pressable onPress={() => setTab("staff")} style={[styles.tab, tab === "staff" && styles.tabOn]}>
            <Text style={[styles.tabText, tab === "staff" && styles.tabTextOn]}>Staff</Text>
          </Pressable>
        </View>

        {tab === "orders" ? (
          <View style={styles.panel}>
            {!error && orders.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No orders yet"
                subtitle="When the cashier creates POS orders, they appear here in real time."
              />
            ) : null}
            {orders.slice(0, 24).map((o) => (
              <ManagerOrderRow key={o.id} order={o} />
            ))}
          </View>
        ) : (
          <View style={styles.panel}>
            {MOCK_STAFF.map((s) => (
              <View key={s.id} style={[styles.staffRow, shellShadow(1)]}>
                <Text style={styles.staffName}>{s.name}</Text>
                <Text style={styles.staffRole}>{s.role}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.bg },
  errorPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs
  },
  scroll: { padding: space.lg, paddingBottom: space.section },
  hello: { fontSize: 28, fontWeight: "900", color: shell.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: shell.muted, marginBottom: space.lg, marginTop: space.xs },
  statsRow: { flexDirection: "row", gap: space.md, marginBottom: space.md },
  quick: {
    borderRadius: 16,
    padding: space.lg,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border,
    marginBottom: space.xl
  },
  quickTitle: { fontSize: 14, fontWeight: "800", color: shell.text, marginBottom: space.md },
  quickRow: { flexDirection: "row", gap: 10 },
  quickBtn: { flex: 1 },
  tabs: {
    flexDirection: "row",
    backgroundColor: shell.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: shell.border,
    marginBottom: 14
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  tabOn: { backgroundColor: shell.chipBg },
  tabText: { fontSize: 15, fontWeight: "700", color: shell.muted },
  tabTextOn: { color: shell.primary },
  panel: { gap: 10 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border
  },
  orderId: { fontSize: 14, fontWeight: "800", color: shell.text, fontFamily: "monospace" },
  orderMeta: { fontSize: 13, color: shell.muted, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: shell.chipBg
  },
  pillText: { fontSize: 11, fontWeight: "800", color: shell.primary, textTransform: "capitalize" },
  staffRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border
  },
  staffName: { fontSize: 16, fontWeight: "700", color: shell.text },
  staffRole: { fontSize: 13, color: shell.muted, marginTop: 4, textTransform: "capitalize" }
});
