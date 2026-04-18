import React, { useCallback, useLayoutEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeatureGate, NoAccessView } from "../../../../src/components/feature-gate";
import { StaffErrorView } from "../../../../src/components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../../../../src/components/staff-dashboard/staff-loading-view";
import { useTableOrderLive } from "../../../../src/hooks/use-table-order-live";
import { useWaiterMenu } from "../../../../src/hooks/use-waiter-menu";
import type { MenuDocumentItem } from "../../../../src/hooks/use-menu-collection";
import { space, radius } from "../../../../src/theme/design-tokens";
import { staffColors, cardShadow } from "../../../../src/theme/staff-ui";
import {
  appendItemsToTableOrder,
  formatAppendItemsError
} from "../../../../src/services/orderService";
import { formatMarkServedError, markTableOrderServed } from "../../../../src/services/mark-table-order-served";
import { formatRequestBillError, requestTableOrderBill } from "../../../../src/services/request-table-order-bill";

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

type CartLine = { menuItemId: string; name: string; price: number; quantity: number };
type CartState = Record<string, CartLine>;
type CartAction =
  | { type: "ADD"; item: MenuDocumentItem }
  | { type: "DEC"; menuItemId: string }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const { id, name, price } = action.item;
      const prev = state[id];
      const quantity = (prev?.quantity ?? 0) + 1;
      return { ...state, [id]: { menuItemId: id, name, price, quantity } };
    }
    case "DEC": {
      const prev = state[action.menuItemId];
      if (!prev) return state;
      if (prev.quantity <= 1) {
        const { [action.menuItemId]: _removed, ...rest } = state;
        return rest;
      }
      return { ...state, [action.menuItemId]: { ...prev, quantity: prev.quantity - 1 } };
    }
    case "CLEAR":
      return {};
  }
}

function formatMoney(n: number) {
  return `₹${n.toFixed(0)}`;
}

export default function WaiterOrderScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderId?: string | string[]; tableNumber?: string | string[] }>();
  const orderId = (Array.isArray(params.orderId) ? params.orderId[0] : params.orderId) ?? "";
  const tableNumberParam = Array.isArray(params.tableNumber) ? params.tableNumber[0] : params.tableNumber;

  const { order, loading, error } = useTableOrderLive(orderId, true);
  const [marking, setMarking] = useState(false);
  const [billing, setBilling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [cart, dispatch] = useReducer(cartReducer, {});

  const canAddItems =
    order &&
    order.orderType.toLowerCase() === "table" &&
    ["PLACED", "PREPARING"].includes(order.displayStatus.toUpperCase());

  const { items: menuItems, loading: menuLoading, error: menuError, refresh: refreshMenu } = useWaiterMenu(Boolean(canAddItems));

  const tableNumber = (order?.tableNumber && Number.isFinite(order.tableNumber) ? order.tableNumber : 0) || Number(tableNumberParam) || 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: tableNumber ? `Table ${tableNumber} · Order` : "Order",
      headerBackTitleVisible: false
    });
  }, [navigation, tableNumber]);

  const activeStep = order ? stepIndex(order.displayStatus) : 0;
  const isTableTicket = order ? order.orderType.toLowerCase() === "table" : false;
  const canMarkServed =
    isTableTicket && order && order.displayStatus.toUpperCase() === "READY" && !marking;
  const billRequested = order ? order.paymentStatus.toUpperCase() === "REQUESTED" : false;
  const isServed = order ? order.displayStatus.toUpperCase() === "SERVED" : false;
  const canRequestBill = isTableTicket && order && isServed && !billRequested && !billing;

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const addTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartLines]
  );

  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [menuItems, menuQuery]);

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

  const onAppend = useCallback(async () => {
    if (cartLines.length === 0) {
      Alert.alert("Nothing to add", "Choose items below.");
      return;
    }
    setAdding(true);
    try {
      await appendItemsToTableOrder(
        orderId,
        cartLines.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          price: line.price,
          quantity: line.quantity
        }))
      );
      dispatch({ type: "CLEAR" });
      Alert.alert("Items added", "The kitchen queue will reflect the updated ticket.");
    } catch (e) {
      Alert.alert("Could not add items", formatAppendItemsError(e));
    } finally {
      setAdding(false);
    }
  }, [cartLines, orderId]);

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
                <Text style={[styles.timelineLabel, current && styles.timelineLabelCurrent, done && styles.timelineLabelDone]}>
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

  const renderMenuRow = useCallback(
    ({ item }: { item: MenuDocumentItem }) => {
      const qty = cart[item.id]?.quantity ?? 0;
      return (
        <View style={[styles.menuRow, cardShadow()]}>
          <View style={styles.menuRowText}>
            <Text style={styles.menuName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.menuPrice}>{formatMoney(item.price)}</Text>
          </View>
          <View style={styles.menuActions}>
            {qty > 0 ? (
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => dispatch({ type: "DEC", menuItemId: item.id })}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperQty}>{qty}</Text>
                <Pressable
                  onPress={() => dispatch({ type: "ADD", item })}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => dispatch({ type: "ADD", item })} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    },
    [cart]
  );

  const openTable = useCallback(() => {
    const tid = order?.tableId?.trim();
    if (!tid) return;
    router.push(`/waiter/table/${tid}`);
  }, [order?.tableId, router]);

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
            <Text style={styles.kicker}>Table {tableNumber || "—"}</Text>
            <Text style={styles.title}>Order #{order.id.slice(0, 10)}…</Text>
            <Text style={styles.liveHint}>Live — Firestore syncs kitchen and cashier updates.</Text>

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
                {marking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Serve Now</Text>}
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

            {canAddItems ? (
              <View style={[styles.card, cardShadow()]}>
                <Text style={styles.cardTitle}>Add items to this order</Text>
                <Text style={styles.mutedSmall}>Allowed while the ticket is PLACED or PREPARING.</Text>
                {menuLoading && menuItems.length === 0 ? (
                  <StaffLoadingView message="Loading menu…" />
                ) : menuError && menuItems.length === 0 ? (
                  <StaffErrorView message={menuError} onRetry={refreshMenu} />
                ) : (
                  <>
                    <TextInput
                      value={menuQuery}
                      onChangeText={setMenuQuery}
                      placeholder="Search dishes…"
                      placeholderTextColor={staffColors.muted}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <FlatList
                      data={filteredMenu}
                      keyExtractor={(i) => i.id}
                      renderItem={renderMenuRow}
                      scrollEnabled={false}
                      ListEmptyComponent={
                        <Text style={styles.muted}>No menu items match.</Text>
                      }
                    />
                    {cartLines.length > 0 ? (
                      <View style={styles.addSummary}>
                        <Text style={styles.addSummaryLabel}>Adding {cartLines.length} line(s) · {formatMoney(addTotal)}</Text>
                        <Pressable
                          onPress={() => void onAppend()}
                          disabled={adding}
                          style={({ pressed }) => [styles.addMergeBtn, adding && styles.addMergeBtnDisabled, pressed && !adding && styles.pressed]}
                        >
                          {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addMergeBtnText}>Add to order</Text>}
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            {order.tableId ? (
              <Pressable onPress={openTable} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
                <Text style={styles.linkBtnText}>Open table screen</Text>
              </Pressable>
            ) : null}
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
  mutedSmall: { fontSize: 12, color: staffColors.muted, marginBottom: space.md },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 14, color: staffColors.muted, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "900", color: staffColors.accent },
  searchInput: {
    marginBottom: space.md,
    backgroundColor: staffColors.bg,
    borderWidth: 1,
    borderColor: staffColors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 16,
    color: staffColors.text
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: staffColors.bg,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  menuRowText: { flex: 1, paddingRight: space.sm },
  menuName: { fontSize: 15, fontWeight: "700", color: staffColors.text },
  menuPrice: { marginTop: 4, fontSize: 14, fontWeight: "800", color: staffColors.accent },
  menuActions: { alignItems: "flex-end" },
  addBtn: {
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm
  },
  addBtnText: { color: "#fff", fontWeight: "800" },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: staffColors.border },
  stepperBtn: { backgroundColor: staffColors.surface, minWidth: 40, alignItems: "center", paddingVertical: space.sm },
  stepperBtnText: { fontSize: 18, fontWeight: "700", color: staffColors.accent },
  stepperQty: { minWidth: 32, textAlign: "center", fontWeight: "800", color: staffColors.text },
  addSummary: { marginTop: space.md, gap: space.sm },
  addSummaryLabel: { fontSize: 13, fontWeight: "700", color: staffColors.text },
  addMergeBtn: {
    backgroundColor: "#15803D",
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center"
  },
  addMergeBtnDisabled: { opacity: 0.5 },
  addMergeBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  linkBtn: { marginTop: space.lg, alignSelf: "flex-start" },
  linkBtnText: { color: staffColors.accent, fontWeight: "800" }
});
