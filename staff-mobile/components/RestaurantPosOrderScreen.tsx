import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  groupProductsByCategory,
  subscribeMenuProducts,
  type MenuProduct
} from "../services/products";
import {
  cartTotal,
  confirmRestaurantOrder,
  printRestaurantReceipt,
  type CartLine,
  type PlacedRestaurantOrder
} from "../services/restaurant-orders";

const CAT_COL_W = 128;

export type RestaurantPosOrderScreenProps = {
  tableFirestoreId: string;
  tableNumber: number;
  tableDisplayName?: string;
  linkTable: boolean;
  headerLabel?: string;
  confirmHint: string;
};

export function RestaurantPosOrderScreen({
  tableFirestoreId,
  tableNumber,
  tableDisplayName,
  linkTable,
  headerLabel,
  confirmHint
}: RestaurantPosOrderScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placed, setPlaced] = useState<PlacedRestaurantOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const topTitle =
    headerLabel ??
    (tableDisplayName?.trim() ? tableDisplayName.trim() : `Table ${tableNumber || "—"}`);

  const productGridCols = winW >= 520 ? 2 : 2;
  const prodAreaW = Math.max(200, winW - CAT_COL_W - 8);
  const tileGap = 10;
  const tileW = (prodAreaW - 12 * 2 - tileGap * (productGridCols - 1)) / productGridCols;

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
  const categoryNames = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped]);

  useEffect(() => {
    if (categoryNames.length === 0) {
      setSelectedCategory(null);
      return;
    }
    setSelectedCategory((prev) => (prev && categoryNames.includes(prev) ? prev : categoryNames[0]!));
  }, [categoryNames]);

  const productsInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return grouped[selectedCategory] ?? [];
  }, [grouped, selectedCategory]);

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

  const removeLine = useCallback((productId: string) => {
    setPlaced(null);
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const subtotal = useMemo(() => cartTotal(cart), [cart]);
  const total = subtotal;

  const runPrint = useCallback(
    async (p: PlacedRestaurantOrder | null, lines: CartLine[], tot: number, draft: boolean) => {
      try {
        await printRestaurantReceipt({
          tokenNumber: p?.tokenNumber ?? 0,
          tableNumber: p?.tableNumber ?? tableNumber,
          tableLabel: p?.tableLabel ?? topTitle,
          items: p?.items ?? lines,
          total: p?.total ?? tot,
          draft,
          title: draft ? undefined : "NAUSHEEN JUICE CENTER"
        });
      } catch (e) {
        Alert.alert("Print failed", e instanceof Error ? e.message : "Unknown error");
      }
    },
    [tableNumber, topTitle]
  );

  const onConfirmOrder = useCallback(async () => {
    if (!tableFirestoreId.trim()) {
      Alert.alert("Missing table", "Cannot place this order.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Cart is empty", "Add items before placing the order.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await confirmRestaurantOrder({
        tableFirestoreId,
        tableNumber,
        tableDisplayName: tableDisplayName ?? topTitle,
        lines: cart,
        linkTable
      });
      setPlaced(result);
      setCart([]);
      Alert.alert(`Order placed · Token #${result.tokenNumber}`, "Print a receipt for the customer?", [
        { text: "Later", style: "cancel" },
        {
          text: "Print receipt…",
          onPress: () => void runPrint(result, [], 0, false)
        }
      ]);
    } catch (e) {
      Alert.alert("Could not place order", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [cart, linkTable, runPrint, tableDisplayName, tableFirestoreId, tableNumber, topTitle]);

  const onPrintReceipt = useCallback(async () => {
    if (placed) {
      await runPrint(placed, [], 0, false);
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Nothing to print", "Add items to the cart or place an order first.");
      return;
    }
    await runPrint(null, cart, total, true);
  }, [cart, placed, runPrint, total]);

  const renderProductTile = useCallback(
    ({ item: p }: { item: MenuProduct }) => {
      const line = cart.find((c) => c.productId === p.id);
      return (
        <Pressable
          onPress={() => addToCart(p)}
          style={({ pressed }) => [styles.tile, { width: tileW }, pressed && styles.pressed]}
        >
          {p.image ? (
            <Image source={{ uri: p.image }} style={styles.tileImg} resizeMode="cover" />
          ) : (
            <View style={[styles.tileImg, styles.tileImgPh]} />
          )}
          <Text style={styles.tileName} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.tilePrice}>₹{p.price.toFixed(0)}</Text>
          {line ? (
            <View style={styles.tileQty}>
              <Pressable onPress={() => bumpQty(p.id, -1)} style={styles.tileQtyBtn}>
                <Text style={styles.tileQtyTxt}>−</Text>
              </Pressable>
              <Text style={styles.tileQtyVal}>{line.qty}</Text>
              <Pressable onPress={() => bumpQty(p.id, 1)} style={styles.tileQtyBtn}>
                <Text style={styles.tileQtyTxt}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.tileAdd}>Add</Text>
          )}
        </Pressable>
      );
    },
    [addToCart, bumpQty, cart, tileW]
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.headerKicker}>Take order</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {topTitle}
          </Text>
        </View>
        {placed ? (
          <Text style={styles.tokenPill}>#{placed.tokenNumber}</Text>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      {productsError ? <Text style={styles.error}>{productsError}</Text> : null}

      <View style={styles.body}>
        <View style={[styles.catCol, { width: CAT_COL_W }]}>
          <Text style={styles.colHeading}>Categories</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
            keyboardShouldPersistTaps="handled"
          >
            {categoryNames.length === 0 ? (
              <Text style={styles.catEmpty}>—</Text>
            ) : (
              categoryNames.map((name) => {
                const on = name === selectedCategory;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setSelectedCategory(name)}
                    style={[styles.catPill, on && styles.catPillOn]}
                  >
                    <Text style={[styles.catPillText, on && styles.catPillTextOn]} numberOfLines={3}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={styles.prodCol}>
          <Text style={styles.colHeading} numberOfLines={1}>
            {selectedCategory ?? "Products"}
          </Text>
          <FlatList
            key={productGridCols}
            data={productsInCategory}
            numColumns={productGridCols}
            keyExtractor={(p) => p.id}
            columnWrapperStyle={productGridCols > 1 ? styles.prodRow : undefined}
            contentContainerStyle={styles.prodList}
            renderItem={renderProductTile}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {products.length === 0 ? "No products in Firestore." : "No items in this category."}
              </Text>
            }
          />
        </View>
      </View>

      <View style={[styles.cartPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.cartTitle}>Cart</Text>
        <ScrollView style={styles.cartScroll} keyboardShouldPersistTaps="handled">
          {cart.length === 0 ? (
            <Text style={styles.cartEmpty}>Tap products to add.</Text>
          ) : (
            cart.map((item) => (
              <View key={item.productId} style={styles.cartLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLineText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cartLineMeta}>
                    {item.qty} × ₹{item.unitPrice.toFixed(0)}
                  </Text>
                </View>
                <Text style={styles.cartLineAmt}>₹{(item.qty * item.unitPrice).toFixed(0)}</Text>
                <View style={styles.cartLineActions}>
                  <Pressable onPress={() => bumpQty(item.productId, -1)} style={styles.miniBtn}>
                    <Text style={styles.miniBtnTxt}>−</Text>
                  </Pressable>
                  <Pressable onPress={() => bumpQty(item.productId, 1)} style={styles.miniBtn}>
                    <Text style={styles.miniBtnTxt}>+</Text>
                  </Pressable>
                  <Pressable onPress={() => removeLine(item.productId)} style={styles.removeBtn}>
                    <Text style={styles.removeTxt}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.subLabel}>Subtotal</Text>
            <Text style={styles.subVal}>₹{subtotal.toFixed(0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(0)}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void onPrintReceipt()}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.btnSecondaryText}>Print</Text>
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
              <Text style={styles.btnPrimaryText}>Place order</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.hint}>{confirmHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backTxt: { fontSize: 16, fontWeight: "800", color: "#2563eb" },
  headerMid: { flex: 1, alignItems: "center" },
  headerKicker: { fontSize: 11, fontWeight: "800", color: "#64748b", letterSpacing: 0.8 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", marginTop: 2 },
  tokenPill: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 12
  },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 4 },
  body: { flex: 1, flexDirection: "row", minHeight: 0 },
  catCol: {
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    backgroundColor: "#fff"
  },
  prodCol: { flex: 1, minWidth: 0, backgroundColor: "#f8fafc" },
  colHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  catScroll: { paddingHorizontal: 8, paddingBottom: 16 },
  catEmpty: { fontSize: 13, color: "#94a3b8", padding: 8 },
  catPill: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 2,
    borderColor: "transparent"
  },
  catPillOn: { backgroundColor: "#0f172a", borderColor: "#f97316" },
  catPillText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  catPillTextOn: { color: "#fff" },
  prodList: { paddingHorizontal: 12, paddingBottom: 16 },
  prodRow: { gap: 10, marginBottom: 10 },
  tile: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  pressed: { opacity: 0.9 },
  tileImg: { width: "100%", height: 96, borderRadius: 10, backgroundColor: "#e2e8f0" },
  tileImgPh: { backgroundColor: "#e2e8f0" },
  tileName: { marginTop: 8, fontSize: 13, fontWeight: "800", color: "#0f172a", minHeight: 34 },
  tilePrice: { marginTop: 4, fontSize: 14, fontWeight: "700", color: "#64748b" },
  tileQty: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  tileQtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  tileQtyTxt: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: -1 },
  tileQtyVal: { fontWeight: "900", fontSize: 15, color: "#0f172a", minWidth: 20, textAlign: "center" },
  tileAdd: { marginTop: 8, textAlign: "center", fontWeight: "800", color: "#2563eb", fontSize: 13 },
  empty: { textAlign: "center", color: "#94a3b8", padding: 24 },
  cartPanel: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: 300,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  cartTitle: { fontSize: 15, fontWeight: "900", color: "#0f172a", marginBottom: 6 },
  cartScroll: { maxHeight: 120 },
  cartEmpty: { color: "#94a3b8", fontSize: 14, paddingVertical: 8 },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  cartLineText: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cartLineMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  cartLineAmt: { fontSize: 15, fontWeight: "900", color: "#0f172a", marginHorizontal: 8 },
  cartLineActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  miniBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15, marginTop: -1 },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeTxt: { fontSize: 12, fontWeight: "800", color: "#b91c1c" },
  totalsBlock: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  subLabel: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  subVal: { fontSize: 14, fontWeight: "800", color: "#334155" },
  totalLabel: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  totalValue: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center"
  },
  btnSecondaryText: { fontWeight: "800", color: "#334155" },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnDisabled: { opacity: 0.45 },
  hint: { marginTop: 8, fontSize: 11, color: "#94a3b8" }
});
