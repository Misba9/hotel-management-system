import React, { useCallback, useMemo, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { space, radius, elevation } from "../theme/design-tokens";
import { roleAccent, staffColors, cardShadow } from "../theme/staff-ui";
import { useTableOrderTableSync } from "../hooks/use-table-order-table-sync";
import { useWaiterFloorOrders } from "../hooks/use-waiter-floor-orders";
import { useTables, type FloorTable, type TableStatus } from "../hooks/use-tables";
import type { WaiterStackParamList } from "../navigation/waiter-stack-navigator";

type WaiterNav = NativeStackNavigationProp<WaiterStackParamList, "WaiterDashboard">;

function statusLabel(status: TableStatus): "FREE" | "OCCUPIED" {
  return status === "occupied" ? "OCCUPIED" : "FREE";
}

function liveTrackingStyle(status: string): { bg: string; fg: string; pulse?: boolean } {
  const u = status.toUpperCase();
  if (u === "READY") return { bg: "rgba(22, 163, 74, 0.2)", fg: "#15803D", pulse: true };
  if (u === "PREPARING") return { bg: "rgba(245, 158, 11, 0.2)", fg: "#B45309" };
  if (u === "PLACED") return { bg: "rgba(59, 130, 246, 0.15)", fg: "#1D4ED8" };
  if (u === "SERVED") return { bg: "rgba(99, 102, 241, 0.15)", fg: "#4338CA" };
  return { bg: staffColors.border, fg: staffColors.muted };
}

function TableTile({
  table,
  width,
  liveOrderStatus,
  onViewOrders,
  onCreateOrder
}: {
  table: FloorTable;
  width: number;
  /** Realtime kitchen / floor status from open table tickets (see useWaiterFloorOrders). */
  liveOrderStatus: string | null;
  onViewOrders: () => void;
  onCreateOrder: () => void;
}) {
  const busy = table.status === "occupied";
  const label = statusLabel(table.status);
  const track = liveOrderStatus ? liveTrackingStyle(liveOrderStatus) : null;

  return (
    <View style={[styles.tileWrap, { width }]}>
      <View style={[styles.tile, cardShadow(), busy && styles.tileOccupied]}>
        <Pressable
          onPress={onViewOrders}
          style={({ pressed }) => [styles.tileTap, pressed && styles.tileTapPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Table ${table.number}, view active orders`}
        >
          <Text style={[styles.tableLabel, busy && styles.tableLabelOccupied]}>Table {table.number || "—"}</Text>
          <View style={[styles.badge, busy ? styles.badgeBusy : styles.badgeFree]}>
            <Text style={[styles.badgeText, busy ? styles.badgeTextBusy : styles.badgeTextFree]}>{label}</Text>
          </View>
          {track ? (
            <View style={[styles.trackPill, { backgroundColor: track.bg }]}>
              {track.pulse ? <View style={styles.trackDot} /> : null}
              <Text style={[styles.trackText, { color: track.fg }]}>Live · {liveOrderStatus}</Text>
            </View>
          ) : (
            <Text style={styles.trackIdle}>No open tickets</Text>
          )}
          <Text style={styles.tapHint}>Tap to view orders</Text>
        </Pressable>
        <Pressable onPress={onCreateOrder} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaText}>Create Order</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function WaiterDashboardScreen() {
  const navigation = useNavigation<WaiterNav>();
  const { width } = useWindowDimensions();
  const { tables, loading, error, refresh } = useTables(true);
  const { statusByTableNumber } = useWaiterFloorOrders(true);
  const floorTrackingSig = useMemo(
    () =>
      [...statusByTableNumber.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, st]) => `${n}:${st}`)
        .join("|"),
    [statusByTableNumber]
  );
  useTableOrderTableSync(true);

  const horizontalPadding = space.lg * 2;
  const gap = space.md;
  const numColumns = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const tileWidth = (width - horizontalPadding - gap * (numColumns - 1)) / numColumns;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    requestAnimationFrame(() => {
      setTimeout(() => setRefreshing(false), 400);
    });
  }, [refresh]);

  const goOrders = useCallback(
    (t: FloorTable) => {
      navigation.navigate("TableOrdersList", { tableId: t.id, tableNumber: t.number });
    },
    [navigation]
  );

  const goOrder = useCallback(
    (t: FloorTable) => {
      navigation.navigate("TableOrder", { tableId: t.id, tableNumber: t.number });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: FloorTable }) => (
      <TableTile
        table={item}
        width={tileWidth}
        liveOrderStatus={statusByTableNumber.get(item.number) ?? null}
        onViewOrders={() => goOrders(item)}
        onCreateOrder={() => goOrder(item)}
      />
    ),
    [goOrder, goOrders, statusByTableNumber, tileWidth]
  );

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <View style={styles.root}>
        {loading && tables.length === 0 ? (
          <StaffLoadingView message="Loading tables…" />
        ) : error && tables.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Could not load tables</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            key={numColumns}
            data={tables}
            extraData={floorTrackingSig}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            renderItem={renderItem}
            ListHeaderComponent={
              <View style={styles.header}>
                <Text style={styles.title}>Tables</Text>
                <Text style={styles.subtitle}>
                  Floor syncs open table tickets in realtime (PLACED / PREPARING / READY). Tap a table for the full list and
                  Serve Now.
                </Text>
                {loading ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator size="small" color={staffColors.accent} />
                    <Text style={[styles.inlineLoadingText, { marginLeft: space.sm }]}>Updating…</Text>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No tables yet</Text>
                <Text style={styles.emptyBody}>
                  Seed Firestore &quot;tables&quot; docs with tableNumber (number), status FREE or OCCUPIED.
                </Text>
              </View>
            }
            columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
            contentContainerStyle={[
              styles.listContent,
              tables.length === 0 && styles.listContentEmpty
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={staffColors.accent}
                colors={[staffColors.accent]}
              />
            }
          />
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.section, paddingTop: space.sm },
  listContentEmpty: { flexGrow: 1 },
  columnWrap: { gap: space.md, marginBottom: space.md },
  header: { marginBottom: space.lg },
  title: { fontSize: 24, fontWeight: "800", color: staffColors.text, letterSpacing: -0.4 },
  subtitle: { marginTop: space.xs, fontSize: 14, color: staffColors.muted, lineHeight: 20 },
  inlineLoading: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  inlineLoadingText: { fontSize: 13, color: staffColors.muted, fontWeight: "600" },
  tileWrap: {},
  tile: {
    flex: 1,
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: staffColors.border,
    minHeight: 156
  },
  tileOccupied: {
    backgroundColor: "rgba(219, 39, 119, 0.08)",
    borderWidth: 2,
    borderColor: roleAccent.waiter
  },
  tableLabel: { fontSize: 18, fontWeight: "800", color: staffColors.text },
  tableLabelOccupied: { color: roleAccent.waiter },
  tileTap: { marginBottom: space.sm },
  tileTapPressed: { opacity: 0.88 },
  trackPill: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.md
  },
  trackDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  trackText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  trackIdle: { marginTop: space.sm, fontSize: 11, fontWeight: "600", color: staffColors.muted },
  tapHint: { marginTop: space.xs, fontSize: 11, fontWeight: "600", color: staffColors.muted },
  badge: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full
  },
  badgeFree: { backgroundColor: "rgba(22, 163, 74, 0.12)" },
  badgeBusy: { backgroundColor: "rgba(245, 158, 11, 0.18)" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  badgeTextFree: { color: staffColors.success },
  badgeTextBusy: { color: "#B45309" },
  cta: {
    marginTop: "auto",
    paddingTop: space.md,
    backgroundColor: staffColors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
    ...elevation(2)
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  center: { flex: 1, justifyContent: "center", padding: space.xxl, alignItems: "center" },
  errorTitle: { fontSize: 18, fontWeight: "800", color: staffColors.text },
  errorBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center" },
  retry: { marginTop: space.lg, backgroundColor: staffColors.accent, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.md },
  retryText: { color: "#fff", fontWeight: "700" },
  empty: { paddingVertical: space.section, paddingHorizontal: space.md },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: staffColors.text, textAlign: "center" },
  emptyBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center", lineHeight: 20 }
});
