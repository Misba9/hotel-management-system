import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { useTableActiveOrders, type TableActiveOrder } from "../hooks/use-table-active-orders";
import type { WaiterStackParamList } from "../navigation/waiter-stack-navigator";
import { space, radius } from "../theme/design-tokens";
import { staffColors, cardShadow } from "../theme/staff-ui";
import { formatMarkServedError, markTableOrderServed } from "../services/mark-table-order-served";
import { formatRequestBillError, requestTableOrderBill } from "../services/request-table-order-bill";

type Props = NativeStackScreenProps<WaiterStackParamList, "TableOrdersList">;

const KITCHEN_STEPS = ["PLACED", "PREPARING", "READY"] as const;

function LiveKitchenStrip({ displayStatus }: { displayStatus: string }) {
  const u = displayStatus.trim().toUpperCase();
  const currentIdx =
    u === "PLACED" ? 0 : u === "PREPARING" ? 1 : u === "READY" ? 2 : u === "SERVED" || u === "COMPLETED" ? 3 : -1;

  if (currentIdx < 0) {
    return (
      <View style={stripStyles.strip}>
        <Text style={stripStyles.stripLabel}>Status</Text>
        <Text style={stripStyles.fallbackStatus}>{displayStatus || "—"}</Text>
      </View>
    );
  }

  return (
    <View style={stripStyles.strip}>
      <Text style={stripStyles.stripLabel}>Kitchen</Text>
      <View style={stripStyles.stepsRow}>
        {KITCHEN_STEPS.map((label, i) => {
          const done = currentIdx > i || currentIdx === 3;
          const current = currentIdx === i && currentIdx < 3;
          const dim = i > currentIdx && currentIdx < 3;
          return (
            <React.Fragment key={label}>
              {i > 0 ? <Text style={stripStyles.arrow}>→</Text> : null}
              <View
                style={[
                  stripStyles.stepPill,
                  done && stripStyles.stepDone,
                  current && stripStyles.stepCurrent,
                  dim && stripStyles.stepDim
                ]}
              >
                <Text
                  style={[
                    stripStyles.stepText,
                    done && stripStyles.stepTextDone,
                    current && stripStyles.stepTextCurrent,
                    dim && stripStyles.stepTextDim
                  ]}
                >
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      {u === "SERVED" ? (
        <Text style={stripStyles.servedNote}>Served — request bill when guests finish.</Text>
      ) : null}
    </View>
  );
}

const stripStyles = StyleSheet.create({
  strip: { marginTop: space.md },
  stripLabel: { fontSize: 10, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.6, marginBottom: 6 },
  stepsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  arrow: { fontSize: 12, color: staffColors.muted, fontWeight: "700" },
  stepPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: staffColors.bg,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  stepDone: { backgroundColor: "rgba(22, 163, 74, 0.12)", borderColor: "rgba(22, 163, 74, 0.35)" },
  stepCurrent: { backgroundColor: "rgba(255, 107, 53, 0.15)", borderColor: staffColors.accent },
  stepDim: { opacity: 0.45 },
  stepText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, color: staffColors.muted },
  stepTextDone: { color: "#15803D" },
  stepTextCurrent: { color: staffColors.accent },
  stepTextDim: { color: staffColors.muted },
  servedNote: { marginTop: 8, fontSize: 12, fontWeight: "600", color: "#4338CA" },
  fallbackStatus: { fontSize: 13, fontWeight: "800", color: staffColors.text }
});

function statusBadgeStyle(displayStatus: string) {
  const u = displayStatus.toUpperCase();
  if (u === "PLACED") return { bg: "rgba(59, 130, 246, 0.15)", fg: "#1D4ED8" };
  if (u === "PREPARING") return { bg: "rgba(245, 158, 11, 0.2)", fg: "#B45309" };
  if (u === "READY") return { bg: "rgba(22, 163, 74, 0.15)", fg: "#15803D" };
  if (u === "SERVED") return { bg: "rgba(99, 102, 241, 0.18)", fg: "#4338CA" };
  return { bg: staffColors.border, fg: staffColors.muted };
}

function OrderCard({
  order,
  billLoading,
  serveLoading,
  onRequestBill,
  onServeNow,
  onOpenDetail
}: {
  order: TableActiveOrder;
  billLoading: boolean;
  serveLoading: boolean;
  onRequestBill: (orderId: string) => void;
  onServeNow: (orderId: string) => void;
  onOpenDetail: () => void;
}) {
  const badge = statusBadgeStyle(order.displayStatus);
  const isTableTicket = order.orderType.toLowerCase() === "table";
  const billRequested = order.paymentStatus.toUpperCase() === "REQUESTED";
  const isReady = order.displayStatus.toUpperCase() === "READY";
  const isServed = order.displayStatus.toUpperCase() === "SERVED";

  return (
    <View style={[styles.card, cardShadow()]}>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.id.slice(0, 8)}, status ${order.displayStatus}. Tap for live details.`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderId} numberOfLines={1}>
            #{order.id.slice(0, 10)}…
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{order.displayStatus}</Text>
          </View>
        </View>
        <Text style={styles.itemsLabel}>Items</Text>
        {order.items.length === 0 ? (
          <Text style={styles.itemLine}>—</Text>
        ) : (
          order.items.map((line, i) => (
            <Text key={`${order.id}-${i}`} style={styles.itemLine}>
              {line.name} × {line.quantity} · ₹{line.price.toFixed(0)}
            </Text>
          ))
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{order.totalAmount.toFixed(0)}</Text>
        </View>
        <LiveKitchenStrip displayStatus={order.displayStatus} />
        <Text style={styles.tapDetailHint}>Tap card for full timeline & payment</Text>
      </Pressable>
      {isTableTicket && isReady ? (
        <Pressable
          onPress={() => onServeNow(order.id)}
          disabled={serveLoading}
          style={({ pressed }) => [
            styles.serveBtn,
            serveLoading && styles.billBtnDisabled,
            pressed && !serveLoading && styles.billBtnPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel="Serve now"
        >
          {serveLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.serveBtnText}>Serve Now</Text>
          )}
        </Pressable>
      ) : null}
      {isTableTicket && isServed ? (
        <Pressable
          onPress={() => onRequestBill(order.id)}
          disabled={billRequested || billLoading}
          style={({ pressed }) => [
            styles.billBtn,
            billRequested && styles.billBtnDone,
            (billRequested || billLoading) && styles.billBtnDisabled,
            pressed && !billRequested && !billLoading && styles.billBtnPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={billRequested ? "Bill requested" : "Request bill"}
        >
          {billLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.billBtnText}>{billRequested ? "Bill requested" : "Request bill"}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function TableOrdersListScreen({ route, navigation }: Props) {
  const { tableId, tableNumber } = route.params;
  const { orders, loading, error } = useTableActiveOrders(tableNumber, true);
  const [billRequestingId, setBillRequestingId] = useState<string | null>(null);
  const [serveOrderId, setServeOrderId] = useState<string | null>(null);

  const onServeNow = useCallback(async (orderId: string) => {
    setServeOrderId(orderId);
    try {
      await markTableOrderServed(orderId);
    } catch (e) {
      Alert.alert("Could not mark served", formatMarkServedError(e));
    } finally {
      setServeOrderId(null);
    }
  }, []);

  const onRequestBill = useCallback(async (orderId: string) => {
    setBillRequestingId(orderId);
    try {
      await requestTableOrderBill(orderId);
      Alert.alert("Bill requested", "Cashier can pick this up from the order’s payment status.");
    } catch (e) {
      Alert.alert("Could not request bill", formatRequestBillError(e));
    } finally {
      setBillRequestingId(null);
    }
  }, []);

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.hint}>
            Realtime · Table {tableNumber}. When kitchen marks READY, tap Serve Now; after SERVED, tap Request bill for
            the cashier.
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("TableOrder", { tableId, tableNumber })}
          style={({ pressed }) => [styles.newOrderBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.newOrderBtnText}>Create order</Text>
        </Pressable>
      </View>
    ),
    [navigation, tableId, tableNumber]
  );

  const renderItem = useCallback(
    ({ item }: { item: TableActiveOrder }) => (
      <OrderCard
        order={item}
        billLoading={billRequestingId === item.id}
        serveLoading={serveOrderId === item.id}
        onRequestBill={onRequestBill}
        onServeNow={onServeNow}
        onOpenDetail={() =>
          navigation.navigate("TableOrderDetail", { orderId: item.id, tableNumber })
        }
      />
    ),
    [billRequestingId, navigation, onRequestBill, onServeNow, serveOrderId, tableNumber]
  );

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <View style={styles.root}>
        {loading && orders.length === 0 ? (
          <StaffLoadingView message="Loading orders…" />
        ) : error && orders.length === 0 ? (
          <View style={styles.errorPad}>
            <StaffErrorView message={error} />
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            renderItem={renderItem}
            ListHeaderComponent={header}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No active orders</Text>
                <Text style={styles.emptyBody}>Nothing open for this table, or all orders are COMPLETED.</Text>
              </View>
            }
          />
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  listContent: { padding: space.lg, paddingBottom: space.section },
  errorPad: { flex: 1, justifyContent: "center", padding: space.lg },
  headerBlock: { marginBottom: space.lg },
  liveRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginTop: 4,
    shadowColor: "#22C55E",
    shadowOpacity: 0.6,
    shadowRadius: 4
  },
  hint: { flex: 1, fontSize: 13, color: staffColors.muted, lineHeight: 18 },
  serveBtn: {
    marginTop: space.md,
    backgroundColor: "#15803D",
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  serveBtnText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  newOrderBtn: {
    marginTop: space.md,
    alignSelf: "flex-start",
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md
  },
  newOrderBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  card: {
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  cardMain: { marginBottom: 0 },
  cardPressed: { opacity: 0.92 },
  tapDetailHint: { marginTop: space.sm, fontSize: 11, fontWeight: "700", color: staffColors.accent },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  orderId: { flex: 1, fontSize: 14, fontWeight: "800", color: staffColors.text, marginRight: space.sm },
  badge: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  itemsLabel: { fontSize: 11, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.4, marginBottom: space.xs },
  itemLine: { fontSize: 14, color: staffColors.text, marginBottom: 4 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 13, color: staffColors.muted, fontWeight: "600" },
  totalValue: { fontSize: 18, fontWeight: "900", color: staffColors.accent },
  billBtn: {
    marginTop: space.md,
    backgroundColor: "#0f172a",
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  billBtnPressed: { opacity: 0.88 },
  billBtnDisabled: { opacity: 0.45 },
  billBtnDone: { backgroundColor: staffColors.muted },
  billBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { paddingVertical: space.section, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: staffColors.text },
  emptyBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center" }
});
