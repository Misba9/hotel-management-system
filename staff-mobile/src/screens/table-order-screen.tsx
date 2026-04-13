import React, { useCallback, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffErrorView } from "../components/staff-dashboard/staff-error-view";
import { StaffLoadingView } from "../components/staff-dashboard/staff-loading-view";
import { useAuth } from "../context/AuthProvider";
import { useWaiterMenu } from "../hooks/use-waiter-menu";
import type { MenuDocumentItem } from "../hooks/use-menu-collection";
import { space, radius, elevation } from "../theme/design-tokens";
import { staffColors, cardShadow } from "../theme/staff-ui";
import type { WaiterStackParamList } from "../navigation/waiter-stack-navigator";
import { formatPlaceOrderError, placeTableOrder } from "../services/place-table-order";

type Props = NativeStackScreenProps<WaiterStackParamList, "TableOrder">;

type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

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
      return {
        ...state,
        [action.menuItemId]: { ...prev, quantity: prev.quantity - 1 }
      };
    }
    case "CLEAR":
      return {};
  }
}

function formatMoney(n: number) {
  return `₹${n.toFixed(0)}`;
}

function MenuListRow({
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
            <Pressable
              onPress={onDec}
              style={({ pressed }) => [styles.stepperBtn, styles.stepperBtnSide, pressed && styles.pressed]}
              accessibilityLabel={`Decrease ${item.name}`}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperQty}>{quantity}</Text>
            <Pressable
              onPress={onAdd}
              style={({ pressed }) => [styles.stepperBtn, styles.stepperBtnSide, pressed && styles.pressed]}
              accessibilityLabel={`Increase ${item.name}`}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            accessibilityLabel={`Add ${item.name}`}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function TableOrderScreen({ route, navigation }: Props) {
  const { tableId, tableNumber } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items, loading, error, refresh } = useWaiterMenu(true);
  const [cart, dispatch] = useReducer(cartReducer, {});
  const [refreshing, setRefreshing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartLines]
  );
  const itemCount = useMemo(() => cartLines.reduce((n, line) => n + line.quantity, 0), [cartLines]);

  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, menuQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 450);
  }, [refresh]);

  const onAdd = useCallback((item: MenuDocumentItem) => {
    dispatch({ type: "ADD", item });
  }, []);

  const onDec = useCallback((menuItemId: string) => {
    dispatch({ type: "DEC", menuItemId });
  }, []);

  const placeOrder = useCallback(async () => {
    if (cartLines.length === 0) {
      Alert.alert("Cart empty", "Add at least one item from the menu.");
      return;
    }
    const uid = user?.uid;
    if (!uid) {
      Alert.alert("Sign in required", "You must be signed in to place an order.");
      return;
    }
    setPlacing(true);
    try {
      const { orderId } = await placeTableOrder({
        uid,
        tableId,
        tableNumber,
        totalAmount: cartTotal,
        lines: cartLines.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          price: line.price,
          quantity: line.quantity
        }))
      });
      dispatch({ type: "CLEAR" });
      navigation.navigate("TableOrderDetail", { orderId, tableNumber });
    } catch (e) {
      console.error("TableOrderScreen placeOrder", e);
      Alert.alert("Order failed", formatPlaceOrderError(e));
    } finally {
      setPlacing(false);
    }
  }, [cartLines, cartTotal, navigation, tableId, tableNumber, user?.uid]);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Menu</Text>
        <Text style={styles.screenSubtitle}>Table {tableNumber} · from menu + menu_items</Text>
        <TextInput
          value={menuQuery}
          onChangeText={setMenuQuery}
          placeholder="Search dishes…"
          placeholderTextColor={staffColors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
    ),
    [menuQuery, tableNumber]
  );

  const renderItem = useCallback(
    ({ item }: { item: MenuDocumentItem }) => (
      <MenuListRow
        item={item}
        quantity={cart[item.id]?.quantity ?? 0}
        onAdd={() => onAdd(item)}
        onDec={() => onDec(item.id)}
      />
    ),
    [cart, onAdd, onDec]
  );

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <View style={styles.root}>
        {loading && items.length === 0 ? (
          <StaffLoadingView message="Loading menu…" />
        ) : error && items.length === 0 ? (
          <View style={styles.errorWrap}>
            <StaffErrorView message={error} onRetry={refresh} />
          </View>
        ) : (
          <>
            <FlatList
              data={filteredMenu}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              contentContainerStyle={[styles.listContent, { paddingBottom: 240 + insets.bottom }]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={staffColors.accent}
                  colors={[staffColors.accent]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyMenu}>
                  <Text style={styles.emptyTitle}>No menu items</Text>
                  <Text style={styles.emptyBody}>
                    Add items to Firestore &quot;menu&quot; or &quot;menu_items&quot; (name, price, available).
                  </Text>
                </View>
              }
            />

            <View style={[styles.cartBar, { paddingBottom: Math.max(insets.bottom, space.md) }, cardShadow(), elevation(4)]}>
              <Text style={styles.cartSectionTitle}>Cart</Text>
              {cartLines.length === 0 ? (
                <Text style={styles.cartEmpty}>No items yet — tap Add on the menu.</Text>
              ) : (
                <ScrollView style={styles.cartLines} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {cartLines.map((line) => (
                    <View key={line.menuItemId} style={styles.cartLine}>
                      <Text style={styles.cartLineName} numberOfLines={1}>
                        {line.name}
                      </Text>
                      <Text style={styles.cartLineMeta}>
                        {formatMoney(line.price)} × {line.quantity}
                      </Text>
                      <Text style={styles.cartLineSub}>{formatMoney(line.price * line.quantity)}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.cartFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total ({itemCount} items)</Text>
                  <Text style={styles.totalValue}>{formatMoney(cartTotal)}</Text>
                </View>
                <Pressable
                  onPress={() => void placeOrder()}
                  disabled={placing || cartLines.length === 0}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (placing || cartLines.length === 0) && styles.sendBtnDisabled,
                    pressed && cartLines.length > 0 && !placing && styles.pressed
                  ]}
                >
                  {placing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.sendBtnText}>Place Order</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: staffColors.bg },
  listContent: { paddingHorizontal: space.lg, paddingTop: space.sm },
  errorWrap: { flex: 1, justifyContent: "center", padding: space.lg },
  listHeader: { marginBottom: space.lg },
  screenTitle: { fontSize: 22, fontWeight: "800", color: staffColors.text, letterSpacing: -0.3 },
  screenSubtitle: { marginTop: space.xs, fontSize: 13, color: staffColors.muted },
  searchInput: {
    marginTop: space.md,
    backgroundColor: staffColors.surface,
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
  stepperBtn: { backgroundColor: staffColors.surface, minWidth: 44, alignItems: "center", justifyContent: "center", paddingVertical: space.sm },
  stepperBtnSide: { backgroundColor: "#fff5ef" },
  stepperBtnText: { fontSize: 20, fontWeight: "700", color: staffColors.accent, lineHeight: 24 },
  stepperQty: { minWidth: 36, textAlign: "center", fontWeight: "800", fontSize: 16, color: staffColors.text },
  pressed: { opacity: 0.85 },
  emptyMenu: { paddingVertical: space.section, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: staffColors.text },
  emptyBody: { marginTop: space.sm, fontSize: 14, color: staffColors.muted, textAlign: "center", paddingHorizontal: space.lg },
  cartBar: {
    backgroundColor: staffColors.surface,
    borderTopWidth: 1,
    borderTopColor: staffColors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md
  },
  cartSectionTitle: { fontSize: 12, fontWeight: "800", color: staffColors.muted, letterSpacing: 0.5, marginBottom: space.sm },
  cartEmpty: { fontSize: 14, color: staffColors.muted, marginBottom: space.md },
  cartLines: { maxHeight: 140, marginBottom: space.sm },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.xs
  },
  cartLineName: { flex: 1, fontSize: 14, fontWeight: "600", color: staffColors.text, marginRight: space.sm },
  cartLineMeta: { fontSize: 12, color: staffColors.muted, fontWeight: "600", marginRight: space.sm },
  cartLineSub: { fontSize: 14, fontWeight: "800", color: staffColors.text, minWidth: 56, textAlign: "right" },
  cartFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: staffColors.border
  },
  totalLabel: { fontSize: 12, color: staffColors.muted, fontWeight: "600" },
  totalValue: { fontSize: 22, fontWeight: "900", color: staffColors.accent, marginTop: 2 },
  sendBtn: {
    backgroundColor: staffColors.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 }
});
