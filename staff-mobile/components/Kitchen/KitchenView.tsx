import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { KitchenBottomNav, type KitchenNavTab } from "./KitchenBottomNav";
import { KitchenHistoryPanel } from "./KitchenHistoryPanel";
import { KitchenProfilePanel } from "./KitchenProfilePanel";
import { KitchenTicketCard } from "../KitchenTicketCard";
import { printKitchenKot } from "../../services/kitchen-kot-print";
import {
  kitchenAcceptOrder,
  kitchenMarkOrderReady,
  kitchenMarkPickedUp,
  kitchenMarkPreparing,
  markKitchenTicketPrinted,
  type StaffOrderRow
} from "../../services/orders";
import { useKitchenAutoPrintSetting } from "../../src/hooks/use-kitchen-auto-print-setting";
import { useKitchenStageOrders } from "../../src/hooks/use-kitchen-stage-orders";
import { useResponsiveLayout } from "../../src/hooks/use-responsive-layout";
import { getGridColumnCount } from "../../src/lib/responsive";
import type { KitchenStage } from "../../src/lib/kitchen-order-mapper";
import type { KitchenOrder } from "../../src/lib/kitchen-kds";
import { useNetworkStatus } from "../../src/hooks/use-network-status";
import { useSyncStaffAppBadge } from "../../src/services/notifications";

type BusyAction = "accept" | "preparing" | "ready" | "print" | "picked-up" | null;

const NAV_CLEARANCE = 108;

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 ? (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [message, onDismiss, opacity]);

  return (
    <Pressable onPress={onDismiss}>
      <Animated.View style={[styles.successBanner, { opacity }]}>
        <Text style={styles.successBannerText}>{message}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function KitchenView() {
  const { isOnline } = useNetworkStatus();
  const { padding, isTablet, width } = useResponsiveLayout();
  const readyColumns = getGridColumnCount(width, { phone: 1, tablet: 2, largeTablet: 3 });
  const activeColumns = getGridColumnCount(width, { phone: 1, tablet: 2, largeTablet: 3 });
  const [tab, setTab] = useState<KitchenNavTab>("active");
  const stage: KitchenStage = tab === "profile" ? "active" : tab;
  const { autoPrintEnabled, autoPrintReady, reloadAutoPrintSetting } = useKitchenAutoPrintSetting();
  const { orders, historyOrders, rowsById, counts, loading, error } = useKitchenStageOrders(
    tab === "profile" ? "active" : tab,
    isOnline
  );
  const [busy, setBusy] = useState<{ id: string; action: BusyAction } | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const pendingAutoPrintIdsRef = useRef<Set<string>>(new Set());
  const autoPrintInFlightRef = useRef<Set<string>>(new Set());
  const highlightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useSyncStaffAppBadge(isOnline ? counts.active + counts.ready : 0);

  useFocusEffect(
    useCallback(() => {
      void reloadAutoPrintSetting();
    }, [reloadAutoPrintSetting])
  );

  const newOrders = useMemo(() => orders.filter((o) => o.status === "new"), [orders]);
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === "accepted" || o.status === "preparing"),
    [orders]
  );
  const readyOrders = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);

  const markAsNew = useCallback((orderId: string) => {
    setNewOrderIds((prev) => new Set(prev).add(orderId));
    const existing = highlightTimersRef.current[orderId];
    if (existing) clearTimeout(existing);
    highlightTimersRef.current[orderId] = setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      delete highlightTimersRef.current[orderId];
    }, 2500);
  }, []);

  useEffect(() => {
    if (stage !== "active" || tab === "profile" || newOrders.length === 0) return;
    for (const order of newOrders) {
      if (!newOrderIds.has(order.orderId)) markAsNew(order.orderId);
    }
  }, [newOrders, stage, tab, markAsNew, newOrderIds]);

  useEffect(() => {
    if (!autoPrintReady || !autoPrintEnabled || !isOnline || stage !== "active" || tab === "profile") {
      return;
    }
    for (const order of newOrders) {
      const row = rowsById.get(order.orderId);
      if (!row || row.printed === true) continue;
      pendingAutoPrintIdsRef.current.add(order.orderId);
    }
  }, [newOrders, rowsById, isOnline, stage, tab, autoPrintEnabled, autoPrintReady]);

  useEffect(() => {
    if (!autoPrintReady || !autoPrintEnabled || !isOnline || stage !== "active" || tab === "profile") {
      return;
    }

    const queue = pendingAutoPrintIdsRef.current;
    const run = async () => {
      for (const order of newOrders) {
        if (!queue.has(order.orderId)) continue;
        const row = rowsById.get(order.orderId);
        if (!row) continue;
        if (row.printed === true) {
          queue.delete(order.orderId);
          continue;
        }
        if (autoPrintInFlightRef.current.has(order.orderId)) continue;

        queue.delete(order.orderId);
        autoPrintInFlightRef.current.add(order.orderId);
        try {
          await printKitchenKot(row, { source: "auto" });
          await markKitchenTicketPrinted(order.orderId);
        } catch (e) {
          console.error("Kitchen auto-print failed", e);
          queue.add(order.orderId);
        } finally {
          autoPrintInFlightRef.current.delete(order.orderId);
        }
      }
    };

    void run();
  }, [newOrders, rowsById, isOnline, stage, tab, autoPrintEnabled, autoPrintReady]);

  const dismissStatus = useCallback(() => setStatusMessage(null), []);

  const runAction = useCallback(
    async (order: KitchenOrder, action: BusyAction) => {
      const row = rowsById.get(order.orderId);
      if (!row) {
        setStatusMessage("Order not found — wait for sync.");
        return;
      }
      setBusy({ id: order.orderId, action });
      try {
        if (action === "accept") await kitchenAcceptOrder(row);
        else if (action === "preparing") await kitchenMarkPreparing(row);
        else if (action === "ready") await kitchenMarkOrderReady(row);
        else if (action === "picked-up") await kitchenMarkPickedUp(row);

        const labels: Record<Exclude<BusyAction, null | "print">, string> = {
          accept: "accepted — preparing started",
          preparing: "started preparing",
          ready: "marked ready",
          "picked-up": "marked picked up"
        };
        if (action && action !== "print") {
          setStatusMessage(`Order ${order.orderNumber} ${labels[action]}`);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        Alert.alert("Action failed", e instanceof Error ? e.message : "Could not update order.");
      } finally {
        setBusy(null);
      }
    },
    [rowsById]
  );

  const runPrint = useCallback(async (row: StaffOrderRow) => {
    setBusy({ id: row.id, action: "print" });
    try {
      await printKitchenKot(row, { source: "manual" });
    } catch {
      Alert.alert("Print failed", "Could not print this ticket. Try again.");
    } finally {
      setBusy(null);
    }
  }, []);

  const connectionLabel = !isOnline
    ? "Offline • reconnect to sync"
    : loading && tab !== "profile"
      ? "Connecting to kitchen queue…"
      : "Live • Cloud Connected";

  const renderCard = (order: KitchenOrder, showReadyActions = false) => {
    const row = rowsById.get(order.orderId);
    if (!row) return null;
    return (
      <KitchenTicketCard
        key={order.orderId}
        order={order}
        busy={busy?.id === order.orderId ? (busy?.action ?? null) : null}
        onAccept={() => void runAction(order, "accept")}
        onMarkReady={() => void runAction(order, "ready")}
        onPickedUp={() => void runAction(order, "picked-up")}
        onPrint={() => void runPrint(row)}
        isNew={newOrderIds.has(order.orderId)}
        showReadyActions={showReadyActions}
      />
    );
  };

  const activeFlatOrders = useMemo(() => {
    return [...newOrders, ...preparingOrders];
  }, [newOrders, preparingOrders]);

  const listBottomPad = { paddingBottom: NAV_CLEARANCE + 16 };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={[styles.header, { paddingHorizontal: padding }]}>
        <Text style={[styles.heading, isTablet && styles.headingTablet]}>Kitchen</Text>
        <Text style={[styles.sub, isTablet && styles.subTablet]}>{connectionLabel}</Text>
      </View>

      {!isOnline ? (
        <Text style={[styles.banner, { marginHorizontal: padding }]}>No connection</Text>
      ) : null}
      {error && tab !== "profile" ? (
        <Text style={[styles.errorBanner, { marginHorizontal: padding }]}>{error}</Text>
      ) : null}
      {statusMessage ? (
        <View style={{ marginHorizontal: padding }}>
          <SuccessToast message={statusMessage} onDismiss={dismissStatus} />
        </View>
      ) : null}

      <View style={styles.body}>
        {tab === "profile" ? (
          <KitchenProfilePanel contentBottomInset={NAV_CLEARANCE} />
        ) : loading ? (
          <View style={[styles.loadingWrap, { paddingHorizontal: padding }]}>
            <ActivityIndicator size="small" color="#cbd5e1" />
            <Text style={styles.state}>Loading tickets…</Text>
          </View>
        ) : tab === "history" ? (
          <KitchenHistoryPanel orders={historyOrders} />
        ) : tab === "ready" ? (
          <FlatList
            data={readyOrders}
            key={`ready-${readyColumns}`}
            numColumns={readyColumns}
            keyExtractor={(o) => o.orderId}
            contentContainerStyle={[styles.list, { paddingHorizontal: padding }, listBottomPad]}
            columnWrapperStyle={readyColumns > 1 ? styles.gridRow : undefined}
            renderItem={({ item }) => (
              <View style={readyColumns > 1 ? styles.gridCell : styles.gridCellSingle}>
                {renderCard(item, true)}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No orders ready</Text>
                <Text style={styles.emptyHint}>Finished tickets wait here for pickup</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={activeFlatOrders}
            key={`active-${activeColumns}`}
            numColumns={activeColumns}
            keyExtractor={(o) => o.orderId}
            contentContainerStyle={[styles.list, { paddingHorizontal: padding }, listBottomPad]}
            columnWrapperStyle={activeColumns > 1 ? styles.gridRow : undefined}
            ListHeaderComponent={
              activeFlatOrders.length > 0 ? (
                <SectionHeader
                  title="Orders"
                  count={activeFlatOrders.length}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <View style={activeColumns > 1 ? styles.gridCell : styles.gridCellSingle}>
                {renderCard(item, false)}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No active orders</Text>
                <Text style={styles.emptyHint}>New and in-progress tickets appear here</Text>
              </View>
            }
          />
        )}
      </View>

      <KitchenBottomNav stage={tab} counts={counts} onStageChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", height: "100%", alignSelf: "stretch", backgroundColor: "#0f172a" },
  header: { paddingTop: 8, paddingBottom: 4, width: "100%" },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#f8fafc"
  },
  headingTablet: { fontSize: 34 },
  sub: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
    marginBottom: 6,
    lineHeight: 20
  },
  subTablet: { fontSize: 16 },
  body: { flex: 1, width: "100%", alignSelf: "stretch" },
  banner: {
    color: "#f8fafc",
    backgroundColor: "#334155",
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
    fontWeight: "700"
  },
  errorBanner: {
    color: "#fecaca",
    backgroundColor: "#7f1d1d",
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
    fontWeight: "600"
  },
  successBanner: {
    backgroundColor: "#134e4a",
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  successBannerText: {
    color: "#ccfbf1",
    textAlign: "center",
    fontWeight: "600"
  },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  state: { color: "#cbd5e1", fontSize: 14 },
  list: { width: "100%", flexGrow: 1 },
  gridRow: { gap: 12 },
  gridCell: { flex: 1, minWidth: 0, marginBottom: 4 },
  gridCellSingle: { width: "100%", marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#e2e8f0", letterSpacing: 0.3 },
  sectionBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  sectionBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  emptyWrap: { alignItems: "center", marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#e2e8f0", marginBottom: 6 },
  emptyHint: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 }
});
