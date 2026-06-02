import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useWindowDimensions
} from "react-native";
import { onSnapshot } from "firebase/firestore";

import {
  calculateBillTotals,
  DEFAULT_INVOICE_TAX_PERCENT,
  PAYMENT_METHOD_LABELS,
  printFinalInvoice,
  staffOrderItemsToCartLines,
  type PaymentMethodId
} from "../../services/restaurant-orders";
import {
  markCashierOrderPaid,
  type StaffOrderRow
} from "../../services/orders";
import { mapOrderDoc } from "../../src/services/orders.js";
import { billingQuery } from "../../src/queries/billingQuery";

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function formatOrderType(orderType?: string) {
  const v = String(orderType ?? "").toLowerCase();
  if (v === "table" || v === "dine_in" || v === "dine-in") return "Dine-in";
  return "Parcel";
}

function formatOrderTime(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return "—";
  return maybe.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showPaymentCompletedToast() {
  if (Platform.OS === "android") {
    ToastAndroid.show("Payment completed", ToastAndroid.SHORT);
    return;
  }
  Alert.alert("Payment completed");
}

function formatReceiptDateTime(value: unknown) {
  if (!value || typeof value !== "object") return new Date().toLocaleString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate !== "function") return new Date().toLocaleString();
  return maybe.toDate().toLocaleString();
}

function buildThermalReceiptHtml(item: StaffOrderRow): string {
  const rows =
    item.items.length > 0
      ? item.items
          .map((line) => {
            const name = String(line.name ?? "Item");
            const qty = Number(line.qty ?? 0) || 0;
            const price = Number(line.price ?? 0) || 0;
            return `<div class="line"><span class="name">${name} x ${qty}</span><span class="price">₹${(price * qty).toFixed(
              2
            )}</span></div>`;
          })
          .join("")
      : `<div class="line"><span class="name">No items</span><span class="price">₹0.00</span></div>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: monospace; margin: 0; padding: 0; background: #fff; color: #000; }
      .receipt { width: 58mm; max-width: 58mm; padding: 8px; margin: 0 auto; }
      .center { text-align: center; }
      .title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
      .meta { font-size: 11px; line-height: 1.35; margin-bottom: 8px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .line { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 3px 0; }
      .name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .price { white-space: nowrap; }
      .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; margin-top: 6px; }
      .thanks { text-align: center; margin-top: 10px; font-size: 11px; }
      @page { size: 58mm auto; margin: 2mm; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center title">Shop Name</div>
      <div class="meta">Order ID: ${item.id.slice(0, 10).toUpperCase()}<br/>Date & Time: ${formatReceiptDateTime(
        item.createdAt
      )}</div>
      <div class="divider"></div>
      ${rows}
      <div class="divider"></div>
      <div class="total"><span>Total:</span><span>₹${Number(item.totalAmount ?? 0).toFixed(2)}</span></div>
      <div class="thanks">Thank You!</div>
    </div>
  </body>
</html>`;
}

function openThermalPrintWindow(item: StaffOrderRow): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!win) return false;
  win.document.open();
  win.document.write(buildThermalReceiptHtml(item));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 150);
  return true;
}

function CashierBillingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSplitLayout = width >= 920;
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastCompletedOrder, setLastCompletedOrder] = useState<StaffOrderRow | null>(null);
  const [methodByOrder, setMethodByOrder] = useState<Record<string, PaymentMethodId | undefined>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!billingQuery) {
      setOrders([]);
      setLoading(false);
      setError("Billing query is unavailable.");
      return undefined;
    }
    setLoading(true);
    setError(null);
    console.log("🔥 Cashier listener started");
    let active = true;
    const unsubscribe = onSnapshot(
      billingQuery,
      (snapshot) => {
        if (!active || !isMountedRef.current) return;
        if (snapshot.empty) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const bills = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const base = mapOrderDoc(docSnap.id, data);
          return {
            ...base,
            orderType: typeof data.orderType === "string" ? data.orderType : undefined,
            tableNumber:
              typeof data.tableNumber === "number"
                ? data.tableNumber
                : typeof data.tableNumber === "string"
                  ? Number(data.tableNumber) || undefined
                  : undefined,
            tableId: typeof data.tableId === "string" ? data.tableId : undefined,
            tableName: typeof data.tableName === "string" ? data.tableName : undefined,
            paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : undefined,
            tokenNumber: typeof data.tokenNumber === "number" ? data.tokenNumber : undefined,
            printed: typeof data.printed === "boolean" ? data.printed : undefined,
            canonicalStatus: "served"
          } as StaffOrderRow;
        });

        setOrders(bills);
        setLoading(false);
      },
      (snapshotError) => {
        if (!active || !isMountedRef.current) return;
        console.log("❌ Firestore error:", snapshotError);
        setOrders([]);
        setLoading(false);
        setError(snapshotError instanceof Error ? snapshotError.message : "Could not load bills.");
      }
    );

    return () => {
      console.log("🛑 Cashier listener stopped");
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log("Orders:", orders);
  }, [orders]);

  useFocusEffect(
    React.useCallback(() => {
      console.log("Screen focused");
      return () => console.log("Screen unfocused");
    }, [])
  );

  const setMethod = useCallback((orderId: string, m: PaymentMethodId) => {
    setMethodByOrder((prev) => ({ ...prev, [orderId]: m }));
  }, []);

  const runAcceptPayment = useCallback(async (item: StaffOrderRow) => {
    const method = methodByOrder[item.id];
    if (!method) {
      Alert.alert("Payment method", "Select Cash, UPI, or Card before accepting payment.");
      return;
    }
    setBusyId(item.id);
    try {
      await markCashierOrderPaid(item.id, method);
      setLastCompletedOrder(item);
      setOrders((prev) => prev.filter((o) => o.id !== item.id));
      showPaymentCompletedToast();
    } catch (e) {
      Alert.alert("Could not record payment", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  }, [methodByOrder]);

  const runPrintReceipt = useCallback(async (item: StaffOrderRow) => {
    const webPrinted = openThermalPrintWindow(item);
    if (webPrinted) return;
    const method = methodByOrder[item.id] ?? "cash";
    setBusyId(item.id);
    try {
      const lines = staffOrderItemsToCartLines(item.items);
      const { subtotal, taxAmount, grandTotal, taxPercent } = calculateBillTotals(
        item.totalAmount,
        DEFAULT_INVOICE_TAX_PERCENT
      );
      const token =
        typeof item.tokenNumber === "number" && item.tokenNumber > 0 ? `#${item.tokenNumber}` : "—";
      const table =
        typeof item.tableNumber === "number" && Number.isFinite(item.tableNumber)
          ? String(item.tableNumber)
          : "—";
      await printFinalInvoice({
        orderIdShort: item.id.slice(0, 10).toUpperCase(),
        tableLabel: table,
        tokenLabel: token,
        items: lines,
        subtotal,
        taxPercent,
        taxAmount,
        grandTotal,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[method]
      });
      Alert.alert("Printed", "Receipt sent to the printer.");
    } catch (e) {
      Alert.alert("Could not print receipt", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  }, [methodByOrder]);

  const paymentOptions = useMemo((): PaymentMethodId[] => ["cash", "upi", "card"], []);
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((item) => {
      const id = item.id.toLowerCase();
      const table = typeof item.tableNumber === "number" ? String(item.tableNumber) : "";
      const token = typeof item.tokenNumber === "number" ? String(item.tokenNumber) : "";
      return id.includes(q) || table.includes(q) || token.includes(q);
    });
  }, [orders, searchQuery]);
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null,
    [filteredOrders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrderId && filteredOrders.length > 0) {
      setSelectedOrderId(filteredOrders[0].id);
      return;
    }
    if (selectedOrderId && !filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0]?.id ?? null);
    }
  }, [filteredOrders, selectedOrderId]);

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.content, !isSplitLayout && styles.contentStack]}>
        <View style={[styles.leftPanel, !isSplitLayout && styles.leftPanelStack]}>
          <View style={styles.leftHeaderRow}>
            <Text style={styles.panelTitle}>Active Bills</Text>
            <Pressable style={styles.newOrderBtn} onPress={() => router.push("/cashier/walk-in")}>
            <Text style={styles.newOrderBtnText}>+ New Order</Text>
            </Pressable>
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search order / table / token"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
          {loading && orders.length === 0 ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#0f172a" />
              <Text style={styles.muted}>Loading bills...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <Text style={styles.empty}>No bills in queue</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {filteredOrders.map((item) => {
                const token =
                  typeof item.tokenNumber === "number" && item.tokenNumber > 0 ? `#${item.tokenNumber}` : "—";
                const tableOrParcel =
                  typeof item.tableNumber === "number" && Number.isFinite(item.tableNumber)
                    ? `Table ${String(item.tableNumber)}`
                    : "Parcel";
                const typeLabel = formatOrderType(item.orderType);
                const selected = selectedOrder?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedOrderId(item.id)}
                    style={[styles.billRow, selected && styles.billRowSelected]}
                    hitSlop={4}
                  >
                    {selected ? <View style={styles.billRowSelectedAccent} /> : null}
                    <View>
                      <Text style={styles.billTitle}>Order ID: {item.id.slice(0, 10).toUpperCase()}</Text>
                      <Text style={styles.billMeta}>Type: {typeLabel}</Text>
                      <Text style={styles.billMeta}>Table / Parcel: {tableOrParcel}</Text>
                      <Text style={styles.billMeta}>Items: {item.items.length}</Text>
                      <Text style={styles.billMeta}>Token: {token}</Text>
                    </View>
                    <View style={styles.amountWrap}>
                      <Text style={styles.billAmountLabel}>Total amount</Text>
                      <Text style={styles.billAmount}>{formatMoney(item.totalAmount)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={[styles.rightPanel, !isSplitLayout && styles.rightPanelStack]}>
          <Text style={styles.panelTitle}>Bill Details + Payment</Text>
          {!selectedOrder ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No bill selected</Text>
              <Text style={styles.emptyBody}>Select a bill from Active Bills.</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.invoiceId}>Invoice {selectedOrder.id.slice(0, 10).toUpperCase()}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Order type: {formatOrderType(selectedOrder.orderType)}</Text>
                  <Text style={styles.metaText}>Time: {formatOrderTime(selectedOrder.createdAt)}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <View style={styles.billHeaderRow}>
                    <Text style={[styles.billHeaderText, styles.itemCol]}>Item</Text>
                    <Text style={[styles.billHeaderText, styles.qtyCol]}>Qty</Text>
                    <Text style={[styles.billHeaderText, styles.priceCol]}>Price</Text>
                    <Text style={[styles.billHeaderText, styles.totalCol]}>Total</Text>
                  </View>
                  {selectedOrder.items.map((it, idx) => (
                    <View key={`${it.id}-${idx}`} style={styles.billItemRow}>
                      <Text style={[styles.lineName, styles.itemCol]} numberOfLines={2}>
                        {it.name}
                      </Text>
                      <Text style={[styles.lineAmt, styles.qtyCol]}>{it.qty}</Text>
                      <Text style={[styles.lineAmt, styles.priceCol]}>{formatMoney(it.price)}</Text>
                      <Text style={[styles.lineAmt, styles.totalCol]}>{formatMoney(it.price * it.qty)}</Text>
                    </View>
                  ))}
                  {selectedOrder.items.length === 0 ? <Text style={styles.muted}>No line items.</Text> : null}
                </View>
              </View>

              <View style={styles.card}>
                {(() => {
                  const selected = methodByOrder[selectedOrder.id];
                  const busy = busyId === selectedOrder.id;
                  const { subtotal, taxAmount, grandTotal, taxPercent } = calculateBillTotals(
                    selectedOrder.totalAmount,
                    DEFAULT_INVOICE_TAX_PERCENT
                  );
                  return (
                    <>
                      <View style={styles.lineRow}>
                        <Text style={styles.sumMuted}>Subtotal</Text>
                        <Text style={styles.sumVal}>{formatMoney(subtotal)}</Text>
                      </View>
                      <View style={styles.lineRow}>
                        <Text style={styles.sumMuted}>Tax ({taxPercent}%)</Text>
                        <Text style={styles.sumVal}>{formatMoney(taxAmount)}</Text>
                      </View>
                      <View style={[styles.lineRow, styles.totalRow]}>
                        <Text style={styles.sumTotalLabel}>Total</Text>
                        <Text style={styles.sumTotalVal}>{formatMoney(grandTotal)}</Text>
                      </View>
                      <View style={styles.payRow}>
                        {paymentOptions.map((m) => {
                          const on = selected === m;
                          return (
                            <Pressable
                              key={m}
                              onPress={() => setMethod(selectedOrder.id, m)}
                              style={[styles.payChip, on && styles.payChipOn]}
                            >
                              <Text style={[styles.payChipText, on && styles.payChipTextOn]}>
                                {PAYMENT_METHOD_LABELS[m]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Pressable
                        style={[styles.btn, !selected && styles.btnDisabled]}
                        disabled={busy || !selected}
                        onPress={() => void runAcceptPayment(selectedOrder)}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.btnText}>Accept Payment</Text>
                        )}
                      </Pressable>
                      <Pressable style={styles.btnSecondary} disabled={busy} onPress={() => void runPrintReceipt(selectedOrder)}>
                        <Text style={styles.btnSecondaryText}>Print Receipt</Text>
                      </Pressable>
                      <Pressable
                        style={styles.btnSecondary}
                        disabled={busy || (!selectedOrder && !lastCompletedOrder)}
                        onPress={() => void runPrintReceipt(selectedOrder ?? lastCompletedOrder!)}
                      >
                        <Text style={styles.btnSecondaryText}>Reprint Receipt</Text>
                      </Pressable>
                    </>
                  );
                })()}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default React.memo(CashierBillingScreen);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  error: { color: "#b91c1c", marginBottom: 8 },
  content: { flex: 1, flexDirection: "row", gap: 16 },
  contentStack: { flexDirection: "column" },
  leftPanel: {
    width: "38%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  leftPanelStack: { width: "100%", maxHeight: 280 },
  rightPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  rightPanelStack: { width: "100%" },
  leftHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  newOrderBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff"
  },
  newOrderBtnText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
    marginBottom: 10,
    backgroundColor: "#ffffff"
  },
  scrollBody: { paddingBottom: 4 },
  billRow: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  billRowSelected: { borderColor: "#0f172a", backgroundColor: "#f8fafc" },
  billRowSelectedAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: "#0f172a"
  },
  billTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  billMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  amountWrap: { alignItems: "flex-end" },
  billAmountLabel: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  billAmount: { fontSize: 15, fontWeight: "800", color: "#111827" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff"
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#111827", textAlign: "center" },
  emptyBody: { marginTop: 4, color: "#6b7280", textAlign: "center" },
  muted: { color: "#6b7280" },
  loaderWrap: { paddingVertical: 24, alignItems: "center", gap: 8 },
  card: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb"
  },
  invoiceId: { fontSize: 13, fontWeight: "800", color: "#6b7280", letterSpacing: 0.8, marginBottom: 8 },
  summaryBox: {
    backgroundColor: "#ffffff",
    borderRadius: 8
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  billHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 6,
    marginBottom: 8
  },
  billHeaderText: { fontSize: 12, color: "#6b7280", fontWeight: "700" },
  billItemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  itemCol: { flex: 1.6 },
  qtyCol: { width: 40, textAlign: "center" },
  priceCol: { width: 88, textAlign: "right" },
  totalCol: { width: 88, textAlign: "right" },
  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  lineName: { fontSize: 14, color: "#374151", marginRight: 8 },
  lineAmt: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  sumMuted: { fontSize: 14, color: "#6b7280" },
  sumVal: { fontSize: 14, fontWeight: "700", color: "#374151" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 2 },
  sumTotalLabel: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  sumTotalVal: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  payRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 12 },
  payChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff"
  },
  payChipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  payChipText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  payChipTextOn: { color: "#fff" },
  btn: {
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  btnSecondary: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  btnSecondaryText: { color: "#111827", fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
