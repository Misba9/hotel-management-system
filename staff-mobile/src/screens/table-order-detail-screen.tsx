import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { useTableOrderLive } from "../hooks/use-table-order-live";
import type { WaiterStackParamList } from "../navigation/waiter-stack-navigator";
import { formatMarkServedError, markTableOrderServed } from "../services/mark-table-order-served";
import { formatRequestBillError, requestTableOrderBill } from "../services/request-table-order-bill";
import { space, radius } from "../theme/design-tokens";
import { staffColors, cardShadow } from "../theme/staff-ui";

type Props = NativeStackScreenProps<WaiterStackParamList, "TableOrderDetail">;

const FLOW_STEPS = ["PLACED", "PREPARING", "READY", "SERVED", "COMPLETED"] as const;

function stepIndex(displayStatus: string): number {
  const u = displayStatus.trim().toUpperCase();
  const i = FLOW_STEPS.indexOf(u as (typeof FLOW_STEPS)[number]);
  return i >= 0 ? i : 0;
}

function paymentLabel(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "PENDING") return "Pending";
  if (u === "REQUESTED") return "Bill requested";
  if (u === "PAID") return "Paid";
  return raw || "—";
}

export function TableOrderDetailScreen({ route }: Props) {
  const { orderId, tableNumber } = route.params;
  const insets = useSafeAreaInsets();
  const { order, loading, error } = useTableOrderLive(orderId, true);
  const [marking, setMarking] = useState(false);
  const [billing, setBilling] = useState(false);

  const activeStep = order ? stepIndex(order.displayStatus) : 0;
  const isTableTicket = order ? order.orderType.toLowerCase() === "table" : false;
  const canMarkServed =
    isTableTicket && order && order.displayStatus.toUpperCase() === "READY" && !marking;
  const billRequested = order ? order.paymentStatus.toUpperCase() === "REQUESTED" : false;
  const isServed = order ? order.displayStatus.toUpperCase() === "SERVED" : false;
  const canRequestBill = isTableTicket && order && isServed && !billRequested && !billing;

  const onMarkServed = useCallback(async () => {
    setMarking(true);
    try {
      await markTableOrderServed(orderId);
    } catch (e) {
      Alert.alert("Could not update", formatMarkServedError(e));
    } finally {
      setMarking(false);
    }
  }, [orderId]);

  const onRequestBill = useCallback(async () => {
    setBilling(true);
    try {
      await requestTableOrderBill(orderId);
      Alert.alert("Bill requested", "Cashier will see this order as REQUESTED.");
    } catch (e) {
      Alert.alert("Could not request bill", formatRequestBillError(e));
    } finally {
      setBilling(false);
    }
  }, [orderId]);

  const timeline = useMemo(
    () => (
      <View style={styles.timeline}>
        {FLOW_STEPS.map((step, idx) => {
          const done = idx < activeStep;
          const current = idx === activeStep;
          return (
            <View key={step} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    done && styles.timelineDotDone,
                    current && styles.timelineDotCurrent,
                    !done && !current && styles.timelineDotTodo
                  ]}
                />
                {idx < FLOW_STEPS.length - 1 ? (
                  <View style={[styles.timelineLine, idx < activeStep ? styles.timelineLineDone : undefined]} />
                ) : null}
              </View>
              <View style={styles.timelineTextCol}>
                <Text
                  style={[
                    styles.timelineLabel,
                    current && styles.timelineLabelCurrent,
                    done && styles.timelineLabelDone
                  ]}
                >
                  {step}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    ),
    [activeStep]
  );

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <View style={styles.root}>
        {loading && !order ? (
          <StaffLoadingView message="Listening for updates…" />
        ) : error && !order ? (
          <View style={styles.errorPad}>
            <StaffErrorView message={error} />
          </View>
        ) : !order ? (
          <View style={styles.errorPad}>
            <Text style={styles.muted}>This order is no longer available (removed or completed elsewhere).</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: space.section + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>Table {tableNumber}</Text>
            <Text style={styles.title}>Order #{order.id.slice(0, 10)}…</Text>
            <Text style={styles.liveHint}>Live — updates when kitchen or cashier changes status.</Text>

            <View style={[styles.card, cardShadow()]}>
              <Text style={styles.cardTitle}>Status</Text>
              {timeline}
              <View style={styles.statusPillRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Order</Text>
                  <Text style={styles.pillValue}>{order.displayStatus}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Payment</Text>
                  <Text style={styles.pillValue}>{paymentLabel(order.paymentStatus)}</Text>
                </View>
              </View>
            </View>

            {isTableTicket && canMarkServed ? (
              <Pressable
                onPress={() => void onMarkServed()}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                {marking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Serve Now</Text>
                )}
              </Pressable>
            ) : null}

            {isTableTicket && isServed ? (
              <Pressable
                onPress={() => void onRequestBill()}
                disabled={billRequested || billing}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  (billRequested || billing) && styles.secondaryBtnDisabled,
                  pressed && canRequestBill && !billing && styles.pressed
                ]}
              >
                {billing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.secondaryBtnText}>{billRequested ? "Bill requested" : "Request bill"}</Text>
                )}
              </Pressable>
            ) : null}

            <View style={[styles.card, cardShadow()]}>
              <Text style={styles.cardTitle}>Items</Text>
              {order.items.length === 0 ? (
                <Text style={styles.muted}>—</Text>
              ) : (
                order.items.map((line, i) => (
                  <Text key={`${order.id}-line-${i}`} style={styles.itemLine}>
                    {line.name} × {line.quantity} · ₹{line.price.toFixed(0)}
                  </Text>
                ))
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{order.totalAmount.toFixed(0)}</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  scroll: { padding: space.lg },
  errorPad: { flex: 1, justifyContent: "center", padding: space.lg },
  kicker: { fontSize: 13, fontWeight: "700", color: staffColors.accent, letterSpacing: 0.3 },
  title: { marginTop: space.xs, fontSize: 22, fontWeight: "800", color: staffColors.text },
  liveHint: { marginTop: space.sm, fontSize: 13, color: staffColors.muted, lineHeight: 18 },
  card: {
    marginTop: space.lg,
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.5, marginBottom: space.md },
  timeline: { marginBottom: space.md },
  timelineRow: { flexDirection: "row", minHeight: 36 },
  timelineLeft: { width: 22, alignItems: "center" },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 4
  },
  timelineDotTodo: { borderColor: staffColors.border, backgroundColor: staffColors.surface },
  timelineDotDone: { borderColor: staffColors.success, backgroundColor: staffColors.success },
  timelineDotCurrent: { borderColor: staffColors.accent, backgroundColor: "rgba(255, 107, 53, 0.25)" },
  timelineLine: { flex: 1, width: 2, backgroundColor: staffColors.border, marginVertical: 2 },
  timelineLineDone: { backgroundColor: staffColors.success },
  timelineTextCol: { flex: 1, paddingLeft: space.sm, paddingBottom: space.sm },
  timelineLabel: { fontSize: 14, fontWeight: "600", color: staffColors.muted },
  timelineLabelCurrent: { color: staffColors.text, fontWeight: "800" },
  timelineLabelDone: { color: staffColors.success },
  statusPillRow: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  pill: {
    flex: 1,
    backgroundColor: staffColors.bg,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  pillLabel: { fontSize: 11, fontWeight: "700", color: staffColors.muted },
  pillValue: { marginTop: 4, fontSize: 15, fontWeight: "800", color: staffColors.text },
  primaryBtn: {
    marginTop: space.lg,
    backgroundColor: staffColors.accent,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center"
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    marginTop: space.md,
    backgroundColor: "#0f172a",
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center"
  },
  secondaryBtnDisabled: { opacity: 0.45 },
  secondaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  pressed: { opacity: 0.9 },
  itemLine: { fontSize: 15, color: staffColors.text, marginBottom: 6 },
  muted: { fontSize: 14, color: staffColors.muted },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 14, color: staffColors.muted, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "900", color: staffColors.accent }
});
