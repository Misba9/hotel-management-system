import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeatureGate, NoAccessView } from "../../../../src/components/feature-gate";
import { StaffErrorView } from "../../../../src/components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../../../../src/components/staff-dashboard/staff-loading-view";
import { useAuth } from "../../../../src/context/AuthProvider";
import { useTableActiveOrders, type TableActiveOrder } from "../../../../src/hooks/use-table-active-orders";
import { useTables, type FloorTable } from "../../../../src/hooks/use-tables";
import { useWaiterMenu } from "../../../../src/hooks/use-waiter-menu";
import type { MenuDocumentItem } from "../../../../src/hooks/use-menu-collection";
import { space, radius, elevation } from "../../../../src/theme/design-tokens";
import { staffColors, cardShadow } from "../../../../src/theme/staff-ui";
import {
  appendItemsToTableOrder,
  formatAppendItemsError,
  formatPlaceOrderError,
  sendOrderToKitchen
} from "../../../../src/services/orderService";
import { formatMarkServedError, markTableOrderServed } from "../../../../src/services/mark-table-order-served";
import { AddItemModal } from "../../../../src/components/waiter/add-item-modal";

const KITCHEN_STEPS = ["PLACED", "PREPARING", "READY"] as const;

function KitchenStatusStrip({ displayStatus }: { displayStatus: string }) {
  const u = displayStatus.trim().toUpperCase();
  const currentIdx =
    u === "PLACED" ? 0 : u === "PREPARING" ? 1 : u === "READY" ? 2 : u === "SERVED" || u === "COMPLETED" ? 3 : -1;

  if (currentIdx < 0) {
    return (
      <View style={stripStyles.wrap}>
        <Text style={stripStyles.fallback}>{displayStatus || "—"}</Text>
      </View>
    );
  }

  return (
    <View style={stripStyles.wrap}>
      <Text style={stripStyles.label}>Kitchen status</Text>
      <View style={stripStyles.row}>
        {KITCHEN_STEPS.map((label, i) => {
          const done = currentIdx > i || currentIdx === 3;
          const current = currentIdx === i && currentIdx < 3;
          const dim = i > currentIdx && currentIdx < 3;
          return (
            <React.Fragment key={label}>
              {i > 0 ? <Text style={stripStyles.arrow}>→</Text> : null}
              <View style={[stripStyles.pill, done && stripStyles.pillDone, current && stripStyles.pillCurrent, dim && stripStyles.pillDim]}>
                <Text style={[stripStyles.pillText, current && stripStyles.pillTextCurrent, done && stripStyles.pillTextDone, dim && stripStyles.pillTextDim]}>
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const stripStyles = StyleSheet.create({
  wrap: { marginTop: space.md },
  label: { fontSize: 11, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  arrow: { fontSize: 12, color: staffColors.muted, fontWeight: "700" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: staffColors.bg,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  pillDone: { backgroundColor: "rgba(22, 163, 74, 0.12)", borderColor: "rgba(22, 163, 74, 0.35)" },
  pillCurrent: { backgroundColor: "rgba(255, 107, 53, 0.15)", borderColor: staffColors.accent },
  pillDim: { opacity: 0.45 },
  pillText: { fontSize: 12, fontWeight: "800", color: staffColors.muted },
  pillTextDone: { color: "#15803D" },
  pillTextCurrent: { color: staffColors.accent },
  pillTextDim: { color: staffColors.muted },
  fallback: { fontSize: 16, fontWeight: "800", color: staffColors.text }
});

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
        const { [action.menuItemId]: _r, ...rest } = state;
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

function MenuRow({
  item,
  quantity,
  onAdd,
  onDec
}: {
  item: MenuDocumentItem;
  quantity: number;
  onAdd: () => void;
  onDec: () => void;
}) {
  return (
    <View style={[styles.menuRow, cardShadow()]}>
      <View style={styles.menuRowText}>
        <Text style={styles.menuName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.menuPrice}>{formatMoney(item.price)}</Text>
      </View>
      <View style={styles.menuActions}>
        {quantity > 0 ? (
          <View style={styles.stepper}>
            <Pressable onPress={onDec} style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}>
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperQty}>{quantity}</Text>
            <Pressable onPress={onAdd} style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}>
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onAdd} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function resolveCurrentOrder(table: FloorTable | null, orders: TableActiveOrder[], isOccupied: boolean): TableActiveOrder | null {
  if (!table || !isOccupied || orders.length === 0) return null;
  if (typeof table.currentOrderId === "string" && table.currentOrderId) {
    const hit = orders.find((o) => o.id === table.currentOrderId);
    if (hit) return hit;
  }
  return orders[0];
}

export default function WaiterTableScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tableId?: string | string[]; compose?: string | string[] }>();
  const tableId = (Array.isArray(params.tableId) ? params.tableId[0] : params.tableId) ?? "";
  const composeRaw = params.compose;
  const wantsCompose =
    composeRaw === "1" ||
    composeRaw === "true" ||
    (Array.isArray(composeRaw) && (composeRaw[0] === "1" || composeRaw[0] === "true"));

  /** FREE: building first ticket. OCCUPIED: adding lines to existing ticket. */
  const [startOrderMode, setStartOrderMode] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [addItemSubmitting, setAddItemSubmitting] = useState(false);
  const [cart, dispatch] = useReducer(cartReducer, {});
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serveLoading, setServeLoading] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");

  const { tables, loading: tablesLoading, error: tablesError, refresh: refreshTables } = useTables(Boolean(tableId));

  const table = useMemo(() => tables.find((t) => t.id === tableId) ?? null, [tables, tableId]);

  const tableNumber = table?.number ?? 0;
  const isFree = table?.status === "free";
  const isOccupied = table?.status === "occupied";

  /** `onSnapshot` on `orders` for this table number — active even when FREE so OCCUPIED + new ticket appear immediately. */
  const { orders, loading: ordersLoading, error: ordersError } = useTableActiveOrders(
    tableNumber,
    Boolean(table && tableNumber > 0)
  );

  const currentOrder = useMemo(() => resolveCurrentOrder(table, orders, isOccupied), [table, orders, isOccupied]);

  const menuEnabled = Boolean(table) && isFree && startOrderMode;
  const { items: menuItems, loading: menuLoading, error: menuError, refresh: refreshMenu } = useWaiterMenu(menuEnabled);

  useEffect(() => {
    if (table && isFree && wantsCompose) {
      setStartOrderMode(true);
    }
  }, [table, isFree, wantsCompose]);

  useEffect(() => {
    if (table?.status === "occupied") {
      setStartOrderMode(false);
    }
  }, [table?.status]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: table ? `Table ${table.number}` : "Table",
      headerBackTitleVisible: false
    });
  }, [navigation, table]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartLines]
  );
  const itemCount = useMemo(() => cartLines.reduce((n, line) => n + line.quantity, 0), [cartLines]);

  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [menuItems, menuQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMenu();
    refreshTables();
    requestAnimationFrame(() => {
      setTimeout(() => setRefreshing(false), 450);
    });
  }, [refreshMenu, refreshTables]);

  const onAdd = useCallback((item: MenuDocumentItem) => {
    dispatch({ type: "ADD", item });
  }, []);

  const onDec = useCallback((menuItemId: string) => {
    dispatch({ type: "DEC", menuItemId });
  }, []);

  const sendNewOrderToKitchen = useCallback(async () => {
    if (cartLines.length === 0) {
      Alert.alert("Cart empty", "Add at least one item.");
      return;
    }
    const uid = user?.uid;
    if (!uid || !table) return;
    setSubmitting(true);
    try {
      await sendOrderToKitchen({
        uid,
        tableId,
        tableNumber: table.number,
        totalAmount: cartTotal,
        lines: cartLines.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          price: line.price,
          quantity: line.quantity
        }))
      });
      dispatch({ type: "CLEAR" });
      setStartOrderMode(false);
    } catch (e) {
      Alert.alert("Could not send order", formatPlaceOrderError(e));
    } finally {
      setSubmitting(false);
    }
  }, [cartLines, cartTotal, table, tableId, user?.uid]);

  const onAddItemFromModal = useCallback(
    async (line: { name: string; price: number; quantity: number }) => {
      if (!currentOrder) return;
      setAddItemSubmitting(true);
      try {
        const menuItemId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await appendItemsToTableOrder(currentOrder.id, [
          { menuItemId, name: line.name, price: line.price, quantity: line.quantity }
        ]);
        setAddItemModalVisible(false);
      } catch (e) {
        Alert.alert("Could not add item", formatAppendItemsError(e));
      } finally {
        setAddItemSubmitting(false);
      }
    },
    [currentOrder]
  );

  const onServeNow = useCallback(async () => {
    if (!currentOrder) return;
    setServeLoading(true);
    try {
      await markTableOrderServed(currentOrder.id);
    } catch (e) {
      Alert.alert("Could not mark served", formatMarkServedError(e));
    } finally {
      setServeLoading(false);
    }
  }, [currentOrder]);

  const statusUpper = currentOrder?.displayStatus?.toUpperCase() ?? "";
  const canServe = isOccupied && currentOrder && statusUpper === "READY";
  const canAddItems = isOccupied && currentOrder && ["PLACED", "PREPARING"].includes(statusUpper);

  if (!tableId) {
    return (
      <FeatureGate feature="waiter_table" fallback={<NoAccessView />}>
        <View style={styles.centerPad}>
          <Text style={styles.muted}>Missing table id.</Text>
        </View>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <View style={styles.root}>
        {tablesLoading && !tablesError ? (
          <StaffLoadingView message="Loading table…" />
        ) : tablesError ? (
          <View style={styles.errorPad}>
            <StaffErrorView message={tablesError.message} />
          </View>
        ) : !table ? (
          <View style={styles.centerPad}>
            <Text style={styles.muted}>Table not found.</Text>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: 200 + insets.bottom }]}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={staffColors.accent} colors={[staffColors.accent]} />
              }
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.tableHeader, cardShadow()]}>
                <Text style={styles.tableTitle}>Table {table.number}</Text>
                <View style={[styles.tableBadge, isFree ? styles.tableBadgeFree : styles.tableBadgeBusy]}>
                  <Text style={[styles.tableBadgeText, isFree ? styles.tableBadgeTextFree : styles.tableBadgeTextBusy]}>
                    {isFree ? "FREE" : "OCCUPIED"}
                  </Text>
                </View>
              </View>

              {isFree && !startOrderMode ? (
                <Pressable
                  onPress={() => setStartOrderMode(true)}
                  style={({ pressed }) => [styles.startOrderBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.startOrderBtnText}>Start Order</Text>
                </Pressable>
              ) : null}

              {isOccupied ? (
                ordersLoading && !currentOrder ? (
                  <StaffLoadingView message="Loading current order…" />
                ) : ordersError && !currentOrder ? (
                  <StaffErrorView message={ordersError} />
                ) : !currentOrder ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnText}>No active order for this table yet. Pull to refresh.</Text>
                  </View>
                ) : (
                  <View style={[styles.orderCard, cardShadow()]}>
                    <Text style={styles.orderCardTitle}>Current order</Text>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Status</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{currentOrder.displayStatus}</Text>
                      </View>
                    </View>
                    <KitchenStatusStrip displayStatus={currentOrder.displayStatus} />
                    <Text style={styles.itemsHeading}>Items</Text>
                    {currentOrder.items.length === 0 ? (
                      <Text style={styles.muted}>—</Text>
                    ) : (
                      currentOrder.items.map((line, i) => (
                        <Text key={`${currentOrder.id}-l-${i}`} style={styles.itemLine}>
                          {line.name} × {line.quantity} · {formatMoney(line.price)}
                        </Text>
                      ))
                    )}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>{formatMoney(currentOrder.totalAmount)}</Text>
                    </View>
                  </View>
                )
              ) : null}

              {isFree && startOrderMode ? (
                menuLoading && menuItems.length === 0 ? (
                  <StaffLoadingView message="Loading menu…" />
                ) : menuError && menuItems.length === 0 ? (
                  <StaffErrorView message={menuError} onRetry={refreshMenu} />
                ) : (
                  <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>Menu</Text>
                    <TextInput
                      value={menuQuery}
                      onChangeText={setMenuQuery}
                      placeholder="Search dishes…"
                      placeholderTextColor={staffColors.muted}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {filteredMenu.map((item) => (
                      <MenuRow
                        key={item.id}
                        item={item}
                        quantity={cart[item.id]?.quantity ?? 0}
                        onAdd={() => onAdd(item)}
                        onDec={() => onDec(item.id)}
                      />
                    ))}
                  </View>
                )
              ) : null}

              {isFree && startOrderMode && cartLines.length > 0 ? (
                <View style={[styles.cartBox, cardShadow()]}>
                  <Text style={styles.cartTitle}>Cart · {itemCount} items · {formatMoney(cartTotal)}</Text>
                </View>
              ) : null}
            </ScrollView>

            <AddItemModal
              visible={addItemModalVisible}
              onClose={() => setAddItemModalVisible(false)}
              onAdd={onAddItemFromModal}
              submitting={addItemSubmitting}
            />

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }, cardShadow(), elevation(4)]}>
              {isOccupied && currentOrder ? (
                <View style={styles.footerRowTwo}>
                  <Pressable
                    onPress={() => {
                      if (!canAddItems) return;
                      setAddItemModalVisible(true);
                    }}
                    disabled={!canAddItems}
                    style={({ pressed }) => [
                      styles.footerBtnSecondary,
                      styles.footerBtnFlex,
                      !canAddItems && styles.footerBtnMuted,
                      pressed && canAddItems && styles.pressed
                    ]}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Add Item</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onServeNow()}
                    disabled={!canServe || serveLoading}
                    style={({ pressed }) => [
                      styles.footerBtnServe,
                      styles.footerBtnFlex,
                      (!canServe || serveLoading) && styles.footerBtnDisabled,
                      pressed && canServe && !serveLoading && styles.pressed
                    ]}
                  >
                    {serveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerBtnServeText}>Serve Now</Text>}
                  </Pressable>
                </View>
              ) : isFree && startOrderMode ? (
                <Pressable
                  onPress={() => void sendNewOrderToKitchen()}
                  disabled={submitting || cartLines.length === 0}
                  style={({ pressed }) => [
                    styles.footerFullBtn,
                    (submitting || cartLines.length === 0) && styles.footerBtnDisabled,
                    pressed && cartLines.length > 0 && !submitting && styles.pressed
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.footerFullBtnText}>Send to Kitchen</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.md },
  centerPad: { flex: 1, padding: space.lg, justifyContent: "center" },
  errorPad: { flex: 1, justifyContent: "center", padding: space.lg },
  muted: { fontSize: 14, color: staffColors.muted },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: staffColors.border,
    marginBottom: space.lg
  },
  tableTitle: { fontSize: 22, fontWeight: "800", color: staffColors.text },
  tableBadge: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.full },
  tableBadgeFree: { backgroundColor: "rgba(22, 163, 74, 0.15)" },
  tableBadgeBusy: { backgroundColor: "rgba(220, 38, 38, 0.15)" },
  tableBadgeText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  tableBadgeTextFree: { color: "#15803D" },
  tableBadgeTextBusy: { color: "#DC2626" },
  startOrderBtn: {
    backgroundColor: staffColors.accent,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: space.lg,
    ...elevation(2)
  },
  startOrderBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  orderCard: {
    backgroundColor: staffColors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: staffColors.border,
    marginBottom: space.lg
  },
  orderCardTitle: { fontSize: 12, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.6, marginBottom: space.md },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  statusLabel: { fontSize: 14, fontWeight: "600", color: staffColors.muted },
  statusPill: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full
  },
  statusPillText: { fontSize: 14, fontWeight: "900", color: "#1D4ED8" },
  itemsHeading: { marginTop: space.md, fontSize: 11, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.4 },
  itemLine: { fontSize: 15, color: staffColors.text, marginTop: 6 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 14, color: staffColors.muted, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "900", color: staffColors.accent },
  warnBox: { padding: space.md, backgroundColor: "rgba(245, 158, 11, 0.12)", borderRadius: radius.md, marginBottom: space.md },
  warnText: { fontSize: 14, color: "#B45309", fontWeight: "600" },
  menuSection: { marginBottom: space.lg },
  menuSectionTitle: { fontSize: 18, fontWeight: "800", color: staffColors.text, marginBottom: space.sm },
  searchInput: {
    backgroundColor: staffColors.surface,
    borderWidth: 1,
    borderColor: staffColors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 16,
    color: staffColors.text,
    marginBottom: space.md
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: staffColors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  menuRowText: { flex: 1, paddingRight: space.sm },
  menuName: { fontSize: 16, fontWeight: "700", color: staffColors.text },
  menuPrice: { marginTop: space.xs, fontSize: 15, fontWeight: "800", color: staffColors.accent },
  menuActions: { alignItems: "flex-end" },
  addBtn: {
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.sm
  },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: staffColors.border },
  stepperBtn: { backgroundColor: staffColors.surface, minWidth: 44, alignItems: "center", paddingVertical: space.sm },
  stepperBtnText: { fontSize: 20, fontWeight: "700", color: staffColors.accent },
  stepperQty: { minWidth: 36, textAlign: "center", fontWeight: "800", fontSize: 16, color: staffColors.text },
  pressed: { opacity: 0.88 },
  cartBox: {
    backgroundColor: staffColors.bg,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: staffColors.border
  },
  cartTitle: { fontSize: 14, fontWeight: "800", color: staffColors.text },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: staffColors.surface,
    borderTopWidth: 1,
    borderTopColor: staffColors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md
  },
  footerRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between" },
  footerRowTwo: { flexDirection: "row", gap: space.md, alignItems: "center" },
  footerBtnFlex: { flex: 1 },
  footerBtnSecondary: {
    flex: 1,
    minWidth: 96,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: staffColors.border,
    alignItems: "center",
    backgroundColor: staffColors.bg
  },
  footerBtnSecondaryText: { fontWeight: "800", fontSize: 13, color: staffColors.text },
  footerBtnMuted: { opacity: 0.4 },
  footerBtnPrimary: {
    flex: 1,
    minWidth: 100,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: staffColors.accent
  },
  footerBtnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  footerBtnServe: {
    flex: 1,
    minWidth: 96,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: "#15803D"
  },
  footerBtnServeText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  footerBtnDisabled: { opacity: 0.45 },
  footerFullBtn: {
    paddingVertical: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: staffColors.accent
  },
  footerFullBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
