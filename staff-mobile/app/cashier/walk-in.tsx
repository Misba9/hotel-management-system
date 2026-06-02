import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useMenuCollection } from "../../src/hooks/use-menu-collection";
import { staffDb } from "../../src/lib/firebase";

type CartLine = { id: string; name: string; price: number; qty: number };

function formatMoney(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(0) : "0"}`;
}

export default function CashierWalkInScreen() {
  const { items, loading, error } = useMenuCollection(true);
  const [orderType, setOrderType] = useState<"dine-in" | "parcel">("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = useCallback((id: string, name: string, price: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((row) => row.id === id);
      if (idx < 0) return [...prev, { id, name, price, qty: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  }, []);

  const bumpQty = useCallback((id: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((row) => row.id === id);
      if (idx < 0) return prev;
      const nextQty = prev[idx].qty + delta;
      if (nextQty <= 0) return prev.filter((row) => row.id !== id);
      const next = [...prev];
      next[idx] = { ...next[idx], qty: nextQty };
      return next;
    });
  }, []);

  const total = useMemo(() => cart.reduce((sum, row) => sum + row.price * row.qty, 0), [cart]);

  const onSendToKitchen = useCallback(async () => {
    if (cart.length === 0) {
      Alert.alert("Cart is empty", "Add items before sending to kitchen.");
      return;
    }
    const parsedTableNumber = Number(tableNumber);
    if (orderType === "dine-in" && (!Number.isFinite(parsedTableNumber) || parsedTableNumber <= 0)) {
      Alert.alert("Table number required", "Enter a valid table number for dine-in orders.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(staffDb, "orders"), {
        items: cart.map((line) => ({ id: line.id, name: line.name, price: line.price, qty: line.qty })),
        totalAmount: total,
        status: "pending",
        paymentStatus: "pending",
        orderType,
        tableNumber: orderType === "dine-in" ? parsedTableNumber : null,
        customerName: orderType === "parcel" ? customerName.trim() : null,
        phone: orderType === "parcel" ? phone.trim() : null,
        createdAt: serverTimestamp()
      });
      setCart([]);
      setTableNumber("");
      setCustomerName("");
      setPhone("");
      Alert.alert("Sent", "Order sent to kitchen.");
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [cart, customerName, orderType, phone, tableNumber, total]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Type</Text>
        <View style={styles.typeRow}>
          <Pressable
            onPress={() => setOrderType("dine-in")}
            style={[styles.typeChip, orderType === "dine-in" && styles.typeChipOn]}
          >
            <Text style={[styles.typeChipText, orderType === "dine-in" && styles.typeChipTextOn]}>Dine-in</Text>
          </Pressable>
          <Pressable
            onPress={() => setOrderType("parcel")}
            style={[styles.typeChip, orderType === "parcel" && styles.typeChipOn]}
          >
            <Text style={[styles.typeChipText, orderType === "parcel" && styles.typeChipTextOn]}>Parcel</Text>
          </Pressable>
        </View>
        {orderType === "dine-in" ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Table Number</Text>
            <TextInput
              value={tableNumber}
              onChangeText={setTableNumber}
              keyboardType="number-pad"
              placeholder="Enter table number"
              placeholderTextColor="#9ca3af"
              style={styles.input}
            />
          </View>
        ) : (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Customer Name (optional)</Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
              placeholderTextColor="#9ca3af"
              style={styles.input}
            />
            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Phone Number (optional)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor="#9ca3af"
              style={styles.input}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Items</Text>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.helper}>Loading menu...</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No menu items</Text>
            <Text style={styles.helper}>Add items in Firestore to start billing.</Text>
          </View>
        ) : (
          <ScrollView style={styles.menuList} contentContainerStyle={styles.menuListBody}>
            {items.map((item) => {
              const cartLine = cart.find((line) => line.id === item.id);
              return (
                <View key={item.id} style={styles.menuRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    <Text style={styles.menuPrice}>{formatMoney(item.price)}</Text>
                  </View>
                  {cartLine ? (
                    <View style={styles.qtyRow}>
                      <Pressable onPress={() => bumpQty(item.id, -1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </Pressable>
                      <Text style={styles.qtyVal}>{cartLine.qty}</Text>
                      <Pressable onPress={() => bumpQty(item.id, 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => addItem(item.id, item.name, item.price)} style={styles.addBtn}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.totalLabel}>Total Price</Text>
        <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        {cart.length === 0 ? <Text style={styles.helper}>Add items to enable Send to Kitchen.</Text> : null}
        <Pressable
          onPress={() => void onSendToKitchen()}
          disabled={submitting || cart.length === 0}
          style={[styles.sendBtn, (submitting || cart.length === 0) && styles.sendBtnDisabled]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send to Kitchen</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff", padding: 16, gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 10 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff"
  },
  typeChipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  typeChipText: { fontWeight: "700", color: "#374151" },
  typeChipTextOn: { color: "#fff" },
  fieldBlock: { marginTop: 12 },
  fieldLabel: { fontSize: 12, color: "#4b5563", fontWeight: "700", marginBottom: 6 },
  fieldLabelSpaced: { marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#ffffff"
  },
  center: { alignItems: "center", paddingVertical: 8 },
  helper: { marginTop: 6, color: "#6b7280", fontSize: 12, textAlign: "center" },
  error: { color: "#b91c1c" },
  emptyBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center"
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  menuList: { maxHeight: 290 },
  menuListBody: { paddingBottom: 4 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  menuName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  menuPrice: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  addBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  qtyVal: { minWidth: 18, textAlign: "center", fontWeight: "800", color: "#111827" },
  totalLabel: { color: "#6b7280", fontSize: 13, marginBottom: 2 },
  totalValue: { fontSize: 26, fontWeight: "900", color: "#111827", marginBottom: 10 },
  sendBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 }
});
