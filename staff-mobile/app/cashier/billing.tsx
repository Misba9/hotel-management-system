import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  calculateBillTotals,
  DEFAULT_INVOICE_TAX_PERCENT,
  PAYMENT_METHOD_LABELS,
  printFinalInvoice,
  staffOrderItemsToCartLines,
  type PaymentMethodId
} from "../../services/restaurant-orders";
import { markCashierOrderPaid, subscribeCashierBillingQueue, type StaffOrderRow } from "../../services/orders";

function formatMoney(n: number) {
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export default function CashierBillingScreen() {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [methodByOrder, setMethodByOrder] = useState<Record<string, PaymentMethodId | undefined>>({});

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeCashierBillingQueue(
      (next) => {
        setOrders(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const setMethod = useCallback((orderId: string, m: PaymentMethodId) => {
    setMethodByOrder((prev) => ({ ...prev, [orderId]: m }));
  }, []);

  const runMarkPaid = useCallback(async (item: StaffOrderRow) => {
    const method = methodByOrder[item.id];
    if (!method) {
      Alert.alert("Payment method", "Select Cash, UPI, QR, or Card before marking paid.");
      return;
    }
    setBusyId(item.id);
    try {
      await markCashierOrderPaid(item.id);
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
      Alert.alert("Paid", "Payment recorded and final bill sent to the printer.");
    } catch (e) {
      Alert.alert("Could not record payment", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  }, [methodByOrder]);

  const paymentOptions = useMemo((): PaymentMethodId[] => ["cash", "upi", "qr", "card"], []);

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Billing</Text>
      <Text style={styles.sub}>Served orders with payment pending — live (no refresh).</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && orders.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          const selected = methodByOrder[item.id];
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
          return (
            <View style={styles.card}>
              <Text style={styles.invoiceId}>Invoice {item.id.slice(0, 10).toUpperCase()}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Table {table}</Text>
                <Text style={styles.meta}>Token {token}</Text>
              </View>

              <Text style={styles.sectionLabel}>Bill summary</Text>
              <View style={styles.summaryBox}>
                {item.items.map((it, idx) => (
                  <View key={`${it.id}-${idx}`} style={styles.lineRow}>
                    <Text style={styles.lineName} numberOfLines={2}>
                      {it.qty}× {it.name}
                    </Text>
                    <Text style={styles.lineAmt}>{formatMoney(it.price * it.qty)}</Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.lineRow}>
                  <Text style={styles.sumMuted}>Subtotal</Text>
                  <Text style={styles.sumVal}>{formatMoney(subtotal)}</Text>
                </View>
                <View style={styles.lineRow}>
                  <Text style={styles.sumMuted}>Tax ({taxPercent}%)</Text>
                  <Text style={styles.sumVal}>{formatMoney(taxAmount)}</Text>
                </View>
                <View style={styles.lineRow}>
                  <Text style={styles.sumTotalLabel}>Total</Text>
                  <Text style={styles.sumTotalVal}>{formatMoney(grandTotal)}</Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Payment</Text>
              <View style={styles.payRow}>
                {paymentOptions.map((m) => {
                  const on = selected === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMethod(item.id, m)}
                      style={[styles.payChip, on && styles.payChipOn]}
                    >
                      <Text style={[styles.payChipText, on && styles.payChipTextOn]}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.rowBtns}>
                <Pressable
                  style={[styles.btn, !selected && styles.btnDisabled]}
                  disabled={busy || !selected}
                  onPress={() => void runMarkPaid(item)}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mark paid</Text>}
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No bills in queue</Text>
          ) : (
            <Text style={styles.empty}> </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  heading: { fontSize: 24, fontWeight: "800", color: "#0f172a", paddingHorizontal: 16, paddingTop: 16 },
  sub: { fontSize: 14, color: "#64748b", paddingHorizontal: 16, marginBottom: 8 },
  error: { color: "#b91c1c", paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 24 },
  empty: { textAlign: "center", marginTop: 48, color: "#64748b", fontSize: 15 },
  loaderWrap: { paddingVertical: 24, alignItems: "center" },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  invoiceId: { fontSize: 13, fontWeight: "800", color: "#64748b", letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 14 },
  meta: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4
  },
  summaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9"
  },
  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  lineName: { flex: 1, fontSize: 14, color: "#334155", marginRight: 8 },
  lineAmt: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 },
  sumMuted: { fontSize: 14, color: "#64748b" },
  sumVal: { fontSize: 14, fontWeight: "700", color: "#334155" },
  sumTotalLabel: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  sumTotalVal: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  payRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  payChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff"
  },
  payChipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  payChipText: { fontSize: 14, fontWeight: "800", color: "#334155" },
  payChipTextOn: { color: "#fff" },
  rowBtns: { marginTop: 16 },
  btn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
