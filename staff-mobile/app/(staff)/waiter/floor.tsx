import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { FeatureGate, NoAccessView } from "../../../src/components/feature-gate";
import { StaffLoadingView } from "../../../src/components/staff-dashboard/staff-loading-view";
import { WaiterSignOutButton } from "../../../src/components/waiter/waiter-sign-out-button";
import { space, radius, elevation } from "../../../src/theme/design-tokens";
import { staffColors, cardShadow } from "../../../src/theme/staff-ui";
import { useTableOrderTableSync } from "../../../src/hooks/use-table-order-table-sync";
import { useWaiterFloorOrders } from "../../../src/hooks/use-waiter-floor-orders";
import { useTables, type FloorTable } from "../../../src/hooks/use-tables";
import { FirebaseError } from "firebase/app";
import {
  createFloorTableForTesting,
  formatSeedDemoTablesError,
  seedFiveDemoTables
} from "../../../src/services/tableService";

const GREEN = "#16A34A";
const RED = "#DC2626";
const YELLOW = "#CA8A04";
const NUM_COLUMNS = 2;

type CardVariant = "free" | "occupied" | "ready";

function cardVariant(table: FloorTable, liveOrderStatus: string | null): CardVariant {
  if (table.status === "free") return "free";
  if (liveOrderStatus?.trim().toUpperCase() === "READY") return "ready";
  return "occupied";
}

function TableCard({
  table,
  width,
  liveOrderStatus,
  onPress
}: {
  table: FloorTable;
  width: number;
  liveOrderStatus: string | null;
  onPress: () => void;
}) {
  const variant = cardVariant(table, liveOrderStatus);
  const busy = table.status === "occupied";

  const badgeLabel =
    variant === "free" ? "FREE" : variant === "ready" ? "READY" : busy ? "OCCUPIED" : "FREE";

  const subline =
    variant === "occupied" && busy && liveOrderStatus && liveOrderStatus.toUpperCase() !== "READY"
      ? liveOrderStatus
      : null;

  const palette =
    variant === "free"
      ? { border: GREEN, bg: "rgba(22, 163, 74, 0.12)", badgeBg: "rgba(22, 163, 74, 0.22)", badgeFg: GREEN }
      : variant === "ready"
        ? {
            border: YELLOW,
            bg: "rgba(202, 138, 4, 0.12)",
            badgeBg: "rgba(234, 179, 8, 0.28)",
            badgeFg: "#A16207"
          }
        : {
            border: RED,
            bg: "rgba(220, 38, 38, 0.1)",
            badgeBg: "rgba(220, 38, 38, 0.2)",
            badgeFg: RED
          };

  return (
    <View style={[styles.cardWrap, { width }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          cardShadow(),
          elevation(2),
          {
            backgroundColor: palette.bg,
            borderWidth: 1,
            borderColor: palette.border,
            borderLeftWidth: 5,
            borderLeftColor: palette.border
          },
          pressed && styles.cardPressed
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Table ${table.number}, ${badgeLabel}. Open table.`}
      >
        <Text style={styles.cardTitle}>Table {table.number || "—"}</Text>
        <View style={[styles.statusBadge, { backgroundColor: palette.badgeBg }]}>
          <Text style={[styles.statusBadgeText, { color: palette.badgeFg }]}>{badgeLabel}</Text>
        </View>
        {subline ? (
          <Text style={styles.subline} numberOfLines={1}>
            {subline}
          </Text>
        ) : (
          <Text style={styles.sublineMuted}>
            {variant === "ready" ? "Food ready · serve" : variant === "free" ? "Available" : "In service"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default function WaiterFloorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { tables, loading, error, refresh } = useTables(true);
  const { statusByTableNumber } = useWaiterFloorOrders(true);
  useTableOrderTableSync(true);

  const floorTrackingSig = useMemo(
    () =>
      [...statusByTableNumber.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, st]) => `${n}:${st}`)
        .join("|"),
    [statusByTableNumber]
  );

  const horizontalPadding = space.lg * 2;
  const gap = space.md;
  const tileWidth = (width - horizontalPadding - gap * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    requestAnimationFrame(() => {
      setTimeout(() => setRefreshing(false), 400);
    });
  }, [refresh]);

  const nextTableNumber = useMemo(() => {
    if (tables.length === 0) return 1;
    return Math.max(...tables.map((t) => t.number)) + 1;
  }, [tables]);

  const onCreateTable = useCallback(async () => {
    setCreating(true);
    try {
      await createFloorTableForTesting(nextTableNumber);
    } catch (e) {
      const isPerm = e instanceof FirebaseError && e.code === "permission-denied";
      const msg = e instanceof Error ? e.message : "Could not create table.";
      Alert.alert(
        "Create table",
        isPerm
          ? "Only manager or admin can create tables in Firestore. Use the admin seed or sign in with a manager account for testing."
          : msg
      );
    } finally {
      setCreating(false);
    }
  }, [nextTableNumber]);

  const onSeedDemoTables = useCallback(async () => {
    setSeeding(true);
    try {
      const { created, skipped } = await seedFiveDemoTables();
      refresh();
      const msg =
        created > 0
          ? `Created ${created} document(s). ${skipped > 0 ? `${skipped} already existed (skipped).` : ""}`
          : skipped >= 5
            ? "Documents table_1 … table_5 already exist."
            : "No new documents were needed.";
      Alert.alert("Demo tables", msg);
    } catch (e) {
      Alert.alert("Could not seed tables", formatSeedDemoTablesError(e));
    } finally {
      setSeeding(false);
    }
  }, [refresh]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Floor",
      headerShown: true,
      headerRight: () => <WaiterSignOutButton />
    });
  }, [navigation]);

  const goTable = useCallback(
    (t: FloorTable) => {
      router.push(`/waiter/table/${t.id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: FloorTable }) => (
      <TableCard
        table={item}
        width={tileWidth}
        liveOrderStatus={statusByTableNumber.get(item.number) ?? null}
        onPress={() => goTable(item)}
      />
    ),
    [goTable, statusByTableNumber, tileWidth]
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <Text style={styles.title}>Floor</Text>
        <Text style={styles.subtitle}>Live tables · green = free, red = occupied, yellow = ready to serve.</Text>
        <Text style={styles.consoleHint}>
          No data? Use “Seed 5 demo tables” below (manager/admin) or add{" "}
          <Text style={styles.consoleHintMono}>tables/table_1…table_5</Text> in Firebase Console.
        </Text>
      </View>
    ),
    []
  );

  const fabBottom = space.lg + insets.bottom;

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
          <>
            <FlatList
              key={NUM_COLUMNS}
              data={tables}
              extraData={floorTrackingSig}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              renderItem={renderItem}
              ListHeaderComponent={header}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No tables found</Text>
                  <Text style={styles.emptyHint}>
                    Seed five FREE rows (ids table_1 … table_5), use the backend seed function, or create one-off tables with +.
                  </Text>
                  <Pressable
                    onPress={() => void onSeedDemoTables()}
                    disabled={seeding}
                    style={({ pressed }) => [styles.seedBtn, (pressed && !seeding) && styles.seedBtnPressed, seeding && styles.seedBtnDisabled]}
                  >
                    {seeding ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.seedBtnText}>Seed 5 demo tables (manager/admin)</Text>
                    )}
                  </Pressable>
                </View>
              }
              columnWrapperStyle={styles.columnWrap}
              contentContainerStyle={[styles.listContent, tables.length === 0 && styles.listContentEmpty]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={staffColors.accent}
                  colors={[staffColors.accent]}
                />
              }
            />
            <Pressable
              onPress={() => void onCreateTable()}
              disabled={creating}
              style={({ pressed }) => [
                styles.fab,
                elevation(4),
                { bottom: fabBottom },
                pressed && !creating && styles.fabPressed,
                creating && styles.fabDisabled
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create new table"
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.fabIcon}>+</Text>}
            </Pressable>
          </>
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: space.section + 72,
    paddingTop: space.sm
  },
  listContentEmpty: { flexGrow: 1 },
  columnWrap: { gap: space.md, marginBottom: space.md },
  header: { marginBottom: space.lg },
  title: { fontSize: 24, fontWeight: "800", color: staffColors.text, letterSpacing: -0.4 },
  subtitle: { marginTop: space.xs, fontSize: 14, color: staffColors.muted, lineHeight: 20 },
  consoleHint: { marginTop: space.md, fontSize: 12, color: staffColors.muted, lineHeight: 18 },
  consoleHintMono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }) },
  cardWrap: {},
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: 132,
    justifyContent: "flex-start"
  },
  cardPressed: { opacity: 0.92 },
  cardTitle: { fontSize: 20, fontWeight: "800", color: staffColors.text, letterSpacing: -0.3 },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full
  },
  statusBadgeText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  subline: { marginTop: space.sm, fontSize: 13, fontWeight: "700", color: staffColors.text },
  sublineMuted: { marginTop: space.sm, fontSize: 12, color: staffColors.muted, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: space.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: staffColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  fabPressed: { opacity: 0.92 },
  fabDisabled: { opacity: 0.65 },
  fabIcon: { color: "#fff", fontSize: 32, fontWeight: "300", marginTop: -2 },
  center: { flex: 1, justifyContent: "center", padding: space.xxl, alignItems: "center" },
  errorTitle: { fontSize: 18, fontWeight: "800", color: staffColors.text },
  errorBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center" },
  retry: {
    marginTop: space.lg,
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md
  },
  retryText: { color: "#fff", fontWeight: "700" },
  empty: { paddingVertical: space.xxl, paddingHorizontal: space.md, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: staffColors.text, textAlign: "center" },
  emptyHint: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center", lineHeight: 20 },
  seedBtn: {
    marginTop: space.lg,
    backgroundColor: staffColors.text,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    minWidth: 260,
    alignItems: "center"
  },
  seedBtnPressed: { opacity: 0.9 },
  seedBtnDisabled: { opacity: 0.55 },
  seedBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, textAlign: "center" }
});
