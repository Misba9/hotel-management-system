import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../context/AuthProvider";
import { createOrder } from "../services/orders.js";
import {
  generateInvoicePdf,
  printInvoice,
  shareInvoicePdf,
  shareInvoiceText
} from "../services/invoice.js";
import { shell, shellShadow } from "../theme/shell-theme";
import { Button, MenuItemCard, ScreenTopBar } from "../components/shell";

const MOCK_MENU = [
  { id: "m1", name: "Masala Dosa", price: 120 },
  { id: "m2", name: "Idli Sambar (2)", price: 80 },
  { id: "m3", name: "Paneer Butter Masala", price: 240 },
  { id: "m4", name: "Butter Naan", price: 50 },
  { id: "m5", name: "Fresh Lime Soda", price: 70 },
  { id: "m6", name: "Gulab Jamun (2)", price: 90 }
];

/**
 * POS — menu grid, cart modal, qty controls. Place order writes `orders/{id}`; kitchen/delivery/admin see it instantly via onSnapshot.
 */
export default function POSScreen() {
  const { signOutUser } = useAuth();
  const [cartMap, setCartMap] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sharingText, setSharingText] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cartLines = useMemo(() => Object.values(cartMap), [cartMap]);
  const totalAmount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.qty, 0),
    [cartLines]
  );

  const addOne = useCallback((item) => {
    setCartMap((prev) => {
      const cur = prev[item.id];
      const nextQty = (cur?.qty ?? 0) + 1;
      return {
        ...prev,
        [item.id]: { id: item.id, name: item.name, price: item.price, qty: nextQty }
      };
    });
  }, []);

  const inc = useCallback((id) => {
    setCartMap((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, qty: cur.qty + 1 } };
    });
  }, []);

  const dec = useCallback((id) => {
    setCartMap((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      if (cur.qty <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }, []);

  const placeOrder = useCallback(async () => {
    if (cartLines.length === 0) {
      Alert.alert("Cart empty", "Add items before placing an order.");
      return;
    }
    setPlacing(true);
    try {
      const items = cartLines.map(({ id, name, price, qty }) => ({ id, name, price, qty }));
      const result = await createOrder({
        items,
        totalAmount,
        customer: { name: "Walk-in", address: "", phone: "" }
      });
      const inv = result.invoice;
      setLastReceipt({
        id: result.orderId,
        orderId: result.orderId,
        items: inv.items,
        subtotal: inv.subtotal,
        tax: inv.tax,
        total: inv.total,
        totalAmount: inv.total,
        customer: { name: "Walk-in", address: "", phone: "" },
        createdAt: new Date().toISOString()
      });
      setCartMap({});
      setCartOpen(false);
      setReceiptOpen(true);
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.code === "permission-denied"
            ? "Permission denied — check Firestore rules (cashier + staff profile)."
            : e.message
          : e instanceof Error
            ? e.message
            : "Could not place order.";
      Alert.alert("Order failed", msg);
    } finally {
      setPlacing(false);
    }
  }, [cartLines, totalAmount]);

  const shareReceiptPdf = useCallback(async () => {
    if (!lastReceipt) return;
    if (Platform.OS === "web") {
      Alert.alert("Receipt", "PDF share is available on the native staff app (iOS/Android).");
      return;
    }
    setSharing(true);
    try {
      const uri = await generateInvoicePdf(lastReceipt);
      await shareInvoicePdf(uri);
    } catch (e) {
      Alert.alert("Receipt failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [lastReceipt]);

  const onPrintReceipt = useCallback(async () => {
    if (!lastReceipt) return;
    if (Platform.OS === "web") {
      Alert.alert("Print", "Printing is available on the native staff app (iOS/Android).");
      return;
    }
    setPrinting(true);
    try {
      await printInvoice(lastReceipt);
    } catch (e) {
      Alert.alert("Print failed", e instanceof Error ? e.message : String(e));
    } finally {
      setPrinting(false);
    }
  }, [lastReceipt]);

  const onShareTextReceipt = useCallback(async () => {
    if (!lastReceipt) return;
    setSharingText(true);
    try {
      await shareInvoiceText(lastReceipt);
    } catch (e) {
      Alert.alert("Share failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSharingText(false);
    }
  }, [lastReceipt]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      const line = cartMap[item.id];
      const selected = Boolean(line && line.qty > 0);
      return (
        <MenuItemCard
          name={item.name}
          price={item.price}
          selected={selected}
          onAdd={() => addOne(item)}
        />
      );
    },
    [cartMap, addOne]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar title="Point of sale" subtitle="Firestore · kitchen sees new orders instantly" onSignOut={() => void signOutUser()} />

      <FlatList
        data={MOCK_MENU}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListFooterComponent={<View style={{ height: 120 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={shell.primary} colors={[shell.primary]} />
        }
      />

      <Pressable style={[styles.stickyBar, shellShadow(8)]} onPress={() => setCartOpen(true)}>
        <View>
          <Text style={styles.stickyLabel}>{cartLines.length} items</Text>
          <Text style={styles.stickyTotal}>₹{totalAmount.toFixed(0)}</Text>
        </View>
        <Text style={styles.stickyCta}>View cart →</Text>
      </Pressable>

      <Modal visible={receiptOpen} animationType="fade" transparent onRequestClose={() => setReceiptOpen(false)}>
        <Pressable style={styles.receiptBackdrop} onPress={() => setReceiptOpen(false)}>
          <Pressable style={[styles.receiptSheet, shellShadow(6)]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Order placed</Text>
            <Text style={styles.receiptSub}>
              {lastReceipt
                ? `Order #${String(lastReceipt.orderId ?? lastReceipt.id).slice(0, 10)}… · ₹${lastReceipt.total ?? lastReceipt.totalAmount}`
                : ""}
            </Text>
            <Button title="Print receipt" onPress={() => void onPrintReceipt()} variant="primary" loading={printing} />
            <Button
              title="Share PDF"
              onPress={() => void shareReceiptPdf()}
              variant="secondary"
              loading={sharing}
              style={{ marginTop: 10 }}
            />
            <Button
              title="Share text"
              onPress={() => void onShareTextReceipt()}
              variant="secondary"
              loading={sharingText}
              style={{ marginTop: 10 }}
            />
            <Button title="Done" onPress={() => setReceiptOpen(false)} variant="secondary" style={{ marginTop: 10 }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cartOpen} animationType="slide" transparent onRequestClose={() => setCartOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCartOpen(false)}>
          <Pressable style={[styles.sheet, shellShadow(6)]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Your cart</Text>
            <ScrollView style={styles.sheetScroll}>
              {cartLines.length === 0 ? (
                <Text style={styles.empty}>No items yet.</Text>
              ) : (
                cartLines.map((line) => (
                  <View key={line.id} style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartName}>{line.name}</Text>
                      <Text style={styles.cartPrice}>₹{line.price} each</Text>
                    </View>
                    <View style={styles.qty}>
                      <Pressable style={styles.qtyBtn} onPress={() => dec(line.id)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyVal}>{line.qty}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => inc(line.id)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.sheetFooter}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>₹{totalAmount.toFixed(0)}</Text>
            </View>
            <Button title="Place order" onPress={() => void placeOrder()} variant="primary" loading={placing} disabled={placing} />
            <Button title="Close" onPress={() => setCartOpen(false)} variant="secondary" style={{ marginTop: 10 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.bg },
  listContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  row: { justifyContent: "space-between", paddingHorizontal: 4 },
  stickyBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 16,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  stickyLabel: { fontSize: 12, fontWeight: "700", color: shell.muted, textTransform: "uppercase" },
  stickyTotal: { fontSize: 22, fontWeight: "900", color: shell.text },
  stickyCta: { fontSize: 15, fontWeight: "800", color: shell.primary },
  receiptBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: shell.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: "78%"
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: shell.border,
    marginBottom: 12
  },
  sheetTitle: { fontSize: 20, fontWeight: "900", color: shell.text, marginBottom: 12 },
  sheetScroll: { maxHeight: 320 },
  empty: { color: shell.muted, paddingVertical: 24, textAlign: "center" },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: shell.border
  },
  cartName: { fontSize: 16, fontWeight: "700", color: shell.text },
  cartPrice: { fontSize: 13, color: shell.muted, marginTop: 2 },
  qty: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: shell.chipBg,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnText: { fontSize: 20, fontWeight: "800", color: shell.primary },
  qtyVal: { fontSize: 16, fontWeight: "800", minWidth: 24, textAlign: "center" },
  sheetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: shell.border
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: shell.muted },
  totalVal: { fontSize: 22, fontWeight: "900", color: shell.text },
  receiptSheet: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 18,
    backgroundColor: shell.surface,
    borderWidth: 1,
    borderColor: shell.border
  },
  receiptSub: { fontSize: 14, color: shell.muted, marginBottom: 18, marginTop: 6 }
});
