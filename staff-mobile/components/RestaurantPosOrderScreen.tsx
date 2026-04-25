import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  flattenProductsForList,
  groupProductsByCategory,
  subscribeMenuProducts,
  type MenuProduct,
  type ProductListRow
} from "../services/products";
import {
  cartTotal,
  confirmRestaurantOrder,
  printRestaurantReceipt,
  type CartLine,
  type PlacedRestaurantOrder
} from "../services/restaurant-orders";

export type RestaurantPosOrderScreenProps = {
  tableFirestoreId: string;
  tableNumber: number;
  /** When true, updates `tables/{id}` occupancy + `currentOrderId`. */
  linkTable: boolean;
  /** Shown in the top bar (e.g. “Walk-in” when `tableNumber` is 0). */
  headerLabel?: string;
  /** Hint under action buttons. */
  confirmHint: string;
};

export function RestaurantPosOrderScreen({
  tableFirestoreId,
  tableNumber,
  linkTable,
  headerLabel,
  confirmHint
}: RestaurantPosOrderScreenProps) {
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placed, setPlaced] = useState<PlacedRestaurantOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const topTitle = headerLabel ?? `Table ${tableNumber || "—"}`;

  useEffect(() => {
    const unsub = subscribeMenuProducts(
      (list) => {
        setProducts(list);
        setProductsError(null);
      },
      (err) => setProductsError(err.message)
    );
    return unsub;
  }, []);

  const grouped = useMemo(() => groupProductsByCategory(products), [products]);
  const listRows = useMemo(() => flattenProductsForList(grouped), [grouped]);

  const addToCart = useCallback((p: MenuProduct) => {
    setPlaced(null);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.price, qty: 1 }];
    });
  }, []);

  const bumpQty = useCallback((productId: string, delta: number) => {
    setPlaced(null);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i < 0) return prev;
      const line = prev[i];
      const q = line.qty + delta;
      if (q < 1) return prev.filter((_, idx) => idx !== i);
      const next = [...prev];
      next[i] = { ...line, qty: q };
      return next;
    });
  }, []);

  const total = useMemo(() => cartTotal(cart), [cart]);

  const onConfirmOrder = useCallback(async () => {
    if (!tableFirestoreId.trim()) {
      Alert.alert("Missing table", "Cannot place this order.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Cart is empty", "Add items before confirming.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await confirmRestaurantOrder({
        tableFirestoreId,
        tableNumber,
        lines: cart,
        linkTable
      });
      setPlaced(result);
      setCart([]);
      Alert.alert("Sent to kitchen", `Token #${result.tokenNumber}`);
    } catch (e) {
      Alert.alert("Could not place order", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [cart, linkTable, tableFirestoreId, tableNumber]);

  const onPrintReceipt = useCallback(async () => {
    try {
      if (placed) {
        await printRestaurantReceipt({
          tokenNumber: placed.tokenNumber,
          tableNumber: placed.tableNumber,
          items: placed.items,
          total: placed.total,
          draft: false
        });
        return;
      }
      if (cart.length === 0) {
        Alert.alert("Nothing to print", "Add items to the cart or confirm an order first.");
        return;
      }
      await printRestaurantReceipt({
        tokenNumber: 0,
        tableNumber,
        items: cart,
        total,
        draft: true
      });
    } catch (e) {
      Alert.alert("Print failed", e instanceof Error ? e.message : "Unknown error");
    }
  }, [cart, placed, tableNumber, total]);

  const renderMenuRow = useCallback(
    ({ item }: { item: ProductListRow }) => {
      if (item.kind === "category") {
        return (
          <View style={styles.catHeader}>
            <Text style={styles.catTitle}>{item.title}</Text>
          </View>
        );
      }
      const p = item.product;
      const line = cart.find((c) => c.productId === p.id);
      return (
        <Pressable onPress={() => addToCart(p)} style={({ pressed }) => [styles.productRow, pressed && styles.pressed]}>
          {p.image ? (
            <Image source={{ uri: p.image }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]} />
          )}
          <View style={styles.productBody}>
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.productPrice}>₹{p.price.toFixed(0)}</Text>
          </View>
          {line ? (
            <View style={styles.qtyRow}>
              <Pressable onPress={() => bumpQty(p.id, -1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyVal}>{line.qty}</Text>
              <Pressable onPress={() => bumpQty(p.id, 1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.addHint}>Add</Text>
          )}
        </Pressable>
      );
    },
    [addToCart, bumpQty, cart]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.tableLabel}>{topTitle}</Text>
        {placed ? (
          <Text style={styles.tokenPill}>Token #{placed.tokenNumber}</Text>
        ) : null}
      </View>
      {productsError ? <Text style={styles.error}>{productsError}</Text> : null}

      <FlatList
        data={listRows}
        keyExtractor={(row, index) => (row.kind === "category" ? `c-${row.title}` : `p-${row.product.id}-${index}`)}
        renderItem={renderMenuRow}
        contentContainerStyle={styles.menuList}
        ListEmptyComponent={
          <Text style={styles.empty}>{products.length === 0 ? "No products in Firestore yet." : ""}</Text>
        }
      />

      <View style={styles.cartPanel}>
        <Text style={styles.cartTitle}>Cart</Text>
        <FlatList
          data={cart}
          keyExtractor={(l) => l.productId}
          style={styles.cartList}
          ListEmptyComponent={<Text style={styles.cartEmpty}>Tap items above to add.</Text>}
          renderItem={({ item }) => (
            <View style={styles.cartLine}>
              <Text style={styles.cartLineText} numberOfLines={1}>
                {item.qty}× {item.name}
              </Text>
              <Text style={styles.cartLineAmt}>₹{(item.qty * item.unitPrice).toFixed(0)}</Text>
            </View>
          )}
        />
        <View style={styles.cartFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{total.toFixed(0)}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void onPrintReceipt()}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.btnSecondaryText}>Print receipt</Text>
          </Pressable>
          <Pressable
            onPress={() => void onConfirmOrder()}
            disabled={submitting || cart.length === 0}
            style={({ pressed }) => [
              styles.btnPrimary,
              (submitting || cart.length === 0) && styles.btnDisabled,
              pressed && !submitting && cart.length > 0 && styles.pressed
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Confirm order</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.hint}>{confirmHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4
  },
  tableLabel: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  tokenPill: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 13
  },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 4 },
  menuList: { paddingBottom: 8 },
  catHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  catTitle: { fontSize: 13, fontWeight: "800", color: "#64748b", letterSpacing: 0.6 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  pressed: { opacity: 0.88 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#e2e8f0" },
  thumbPlaceholder: { backgroundColor: "#e2e8f0" },
  productBody: { flex: 1, marginLeft: 10 },
  productName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  productPrice: { fontSize: 14, color: "#64748b", marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: -1 },
  qtyVal: { fontWeight: "800", minWidth: 22, textAlign: "center", color: "#0f172a" },
  addHint: { fontWeight: "700", color: "#2563eb", fontSize: 13 },
  empty: { textAlign: "center", color: "#94a3b8", padding: 24 },
  cartPanel: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: 280
  },
  cartTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  cartList: { maxHeight: 100 },
  cartEmpty: { color: "#94a3b8", fontSize: 14, paddingVertical: 8 },
  cartLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cartLineText: { flex: 1, fontSize: 14, color: "#334155", marginRight: 8 },
  cartLineAmt: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  totalLabel: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  totalValue: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center"
  },
  btnSecondaryText: { fontWeight: "800", color: "#334155" },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnDisabled: { opacity: 0.45 },
  hint: { marginTop: 8, fontSize: 11, color: "#94a3b8" }
});
